import GLib from 'gi://GLib?version=2.0'
import { BehaviorSubject, Observable } from 'rxjs'
import { LocusDbusClient, PropertyChangedSignal, PropertyRemovedSignal, Unsubscribe } from './locus.generated'

const BUILD_KIND = 'build-invocation'
const BUILD_SUBJECT_PREFIX = 'build-invocation:'

export interface BzBusFailure {
  kind: string
  label: string
  mnemonic: string
  exitCode: number
  message: string
  stdout: string
  stderr: string
}

export interface BzBusActionMnemonic {
  mnemonic: string
  actionsExecuted: number
}

export interface BzBusRunner {
  name: string
  count: number
  execKind: string
}

export interface BzBusTiming {
  cpuMs: number
  wallMs: number
  analysisMs: number
  executionMs: number
}

export interface BzBusActionSummary {
  actionsCreated: number
  actionsExecuted: number
  topMnemonics: BzBusActionMnemonic[]
  runners: BzBusRunner[]
}

export interface BzBusWorker {
  mnemonic: string
  processId: number
  status: string
  memoryKb: number
  actionsExecuted: number
}

export interface BzBusWorkerSummary {
  total: number
  killedDueToMemoryPressure: number
  peakMemoryKb: number
  workers: BzBusWorker[]
}

export interface BzBusNetwork {
  bytesSent: number
  bytesRecv: number
  peakBytesSentPerSec: number
  peakBytesRecvPerSec: number
}

export interface BzBusBuildProgress {
  completed: number
  total: number
  actions: number
  running: number
  line: string
}

export interface BzBusInvocation {
  id: string
  buildId: string
  component: string
  command: string[]
  commandName: string
  cwd: string
  workspaceDir: string
  bazelVersion: string
  serverPid: number
  status: string
  outcome: string
  exitCode: number
  exitCodeName: string
  startedAtUnixMs: number
  endedAtUnixMs: number
  lastSequenceNumber: number
  recentStdout: string
  recentStderr: string
  buildProgress: BzBusBuildProgress
  targetsTotal: number
  targetsFailed: number
  testsTotal: number
  testsFailed: number
  actionsTotal: number
  actionsFailed: number
  failedTargets: string[]
  failedTests: string[]
  failures: BzBusFailure[]
  timing: BzBusTiming
  actionSummary: BzBusActionSummary
  workerSummary: BzBusWorkerSummary
  network: BzBusNetwork
  metadata: Record<string, string>
}

export interface BzBusResources {
  memoryCurrentBytes: number
  memoryPeakBytes: number
  cpuUsageUsec: number
  pids: number
}

export interface BzBusState {
  connected: boolean
  latest: BzBusInvocation | null
  invocations: BzBusInvocation[]
  resources: BzBusResources | null
  error: string
  updatedAtUnixMs: number
}

export interface BzBusService {
  state$: Observable<BzBusState>
  refresh(): void
}

const DEFAULT_TIMING: BzBusTiming = { cpuMs: 0, wallMs: 0, analysisMs: 0, executionMs: 0 }
const DEFAULT_ACTION_SUMMARY: BzBusActionSummary = { actionsCreated: 0, actionsExecuted: 0, topMnemonics: [], runners: [] }
const DEFAULT_WORKER_SUMMARY: BzBusWorkerSummary = { total: 0, killedDueToMemoryPressure: 0, peakMemoryKb: 0, workers: [] }
const DEFAULT_NETWORK: BzBusNetwork = { bytesSent: 0, bytesRecv: 0, peakBytesSentPerSec: 0, peakBytesRecvPerSec: 0 }
const DEFAULT_BUILD_PROGRESS: BzBusBuildProgress = { completed: 0, total: 0, actions: 0, running: 0, line: '' }
const ACTIVE_STALE_MS = 2 * 60 * 60 * 1000

const DEFAULT_STATE: BzBusState = {
  connected: false,
  latest: null,
  invocations: [],
  resources: null,
  error: '',
  updatedAtUnixMs: 0,
}

function numberProperty(properties: Record<string, string>, key: string): number {
  const number = Number(properties[key] ?? 0)
  return Number.isFinite(number) ? number : 0
}

function stringProperty(properties: Record<string, string>, key: string): string {
  return properties[key] ?? ''
}

function jsonProperty<T>(properties: Record<string, string>, key: string, fallback: T): T {
  const value = properties[key]
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch (error) {
    console.warn(`invalid bzbus ${key}: ${error}`)
    return fallback
  }
}

function stringArrayProperty(properties: Record<string, string>, key: string): string[] {
  const values = jsonProperty<unknown>(properties, key, [])
  if (!Array.isArray(values)) return []
  return values.filter((value): value is string => typeof value === 'string')
}

function stringRecordProperty(properties: Record<string, string>, key: string): Record<string, string> {
  const values = jsonProperty<unknown>(properties, key, {})
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {}

  return Object.fromEntries(
    Object.entries(values).map(([entryKey, value]) => [entryKey, String(value)]),
  )
}

function failuresProperty(properties: Record<string, string>): BzBusFailure[] {
  const failures = jsonProperty<unknown>(properties, 'failures-json', [])
  if (!Array.isArray(failures)) return []

  return failures
    .filter((failure): failure is Record<string, unknown> => !!failure && typeof failure === 'object' && !Array.isArray(failure))
    .map(failure => ({
      kind: String(failure.kind ?? ''),
      label: String(failure.label ?? ''),
      mnemonic: String(failure.mnemonic ?? ''),
      exitCode: Number(failure.exit_code ?? failure.exitCode ?? 0) || 0,
      message: String(failure.message ?? ''),
      stdout: String(failure.stdout ?? ''),
      stderr: String(failure.stderr ?? ''),
    }))
}

function actionMnemonicsProperty(properties: Record<string, string>): BzBusActionMnemonic[] {
  const mnemonics = jsonProperty<unknown>(properties, 'top-action-mnemonics-json', [])
  if (!Array.isArray(mnemonics)) return []

  return mnemonics
    .filter((mnemonic): mnemonic is Record<string, unknown> => !!mnemonic && typeof mnemonic === 'object' && !Array.isArray(mnemonic))
    .map(mnemonic => ({
      mnemonic: String(mnemonic.mnemonic ?? ''),
      actionsExecuted: Number(mnemonic.actions_executed ?? mnemonic.actionsExecuted ?? 0) || 0,
    }))
}

function runnersProperty(properties: Record<string, string>): BzBusRunner[] {
  const runners = jsonProperty<unknown>(properties, 'action-runners-json', [])
  if (!Array.isArray(runners)) return []

  return runners
    .filter((runner): runner is Record<string, unknown> => !!runner && typeof runner === 'object' && !Array.isArray(runner))
    .map(runner => ({
      name: String(runner.name ?? ''),
      count: Number(runner.count ?? 0) || 0,
      execKind: String(runner.exec_kind ?? runner.execKind ?? ''),
    }))
}

function workersProperty(properties: Record<string, string>): BzBusWorker[] {
  const workers = jsonProperty<unknown>(properties, 'workers-json', [])
  if (!Array.isArray(workers)) return []

  return workers
    .filter((worker): worker is Record<string, unknown> => !!worker && typeof worker === 'object' && !Array.isArray(worker))
    .map(worker => ({
      mnemonic: String(worker.mnemonic ?? ''),
      processId: Number(worker.process_id ?? worker.processId ?? 0) || 0,
      status: String(worker.status ?? ''),
      memoryKb: Number(worker.memory_kb ?? worker.memoryKb ?? 0) || 0,
      actionsExecuted: Number(worker.actions_executed ?? worker.actionsExecuted ?? 0) || 0,
    }))
}

function idFromSubject(subject: string): string {
  return subject.startsWith(BUILD_SUBJECT_PREFIX) ? subject.slice(BUILD_SUBJECT_PREFIX.length) : subject
}

function invocationFromProperties(subject: string, properties: Record<string, string>): BzBusInvocation {
  const actionsCompleted = numberProperty(properties, 'actions-completed')
  const actionsExecuted = numberProperty(properties, 'actions-executed') || actionsCompleted
  const totalActions = numberProperty(properties, 'total-actions')
  const progressCompleted = numberProperty(properties, 'progress-completed')
  const progressTotal = numberProperty(properties, 'progress-total')
  const runningActions = numberProperty(properties, 'running-actions')
  const progressActions = numberProperty(properties, 'progress-actions') || actionsCompleted
  const workers = workersProperty(properties)
  const buildMetadata = stringRecordProperty(properties, 'build-metadata-json')

  return {
    id: stringProperty(properties, 'id') || idFromSubject(subject),
    buildId: stringProperty(properties, 'build-id'),
    component: stringProperty(properties, 'component'),
    command: stringArrayProperty(properties, 'command-json'),
    commandName: stringProperty(properties, 'command-name'),
    cwd: stringProperty(properties, 'cwd'),
    workspaceDir: stringProperty(properties, 'workspace-dir'),
    bazelVersion: stringProperty(properties, 'bazel-version'),
    serverPid: numberProperty(properties, 'server-pid'),
    status: stringProperty(properties, 'status') || 'unknown',
    outcome: stringProperty(properties, 'outcome') || 'unknown',
    exitCode: numberProperty(properties, 'exit-code'),
    exitCodeName: stringProperty(properties, 'exit-code-name'),
    startedAtUnixMs: numberProperty(properties, 'started-at-unix-ms'),
    endedAtUnixMs: numberProperty(properties, 'ended-at-unix-ms'),
    lastSequenceNumber: numberProperty(properties, 'last-observed-sequence-number'),
    recentStdout: stringProperty(properties, 'recent-stdout'),
    recentStderr: stringProperty(properties, 'recent-stderr'),
    buildProgress: {
      completed: progressCompleted,
      total: progressTotal,
      actions: progressActions,
      running: runningActions,
      line: stringProperty(properties, 'progress-line'),
    },
    targetsTotal: numberProperty(properties, 'targets-total'),
    targetsFailed: numberProperty(properties, 'targets-failed'),
    testsTotal: numberProperty(properties, 'tests-total'),
    testsFailed: numberProperty(properties, 'tests-failed'),
    actionsTotal: actionsCompleted,
    actionsFailed: numberProperty(properties, 'actions-failed'),
    failedTargets: stringArrayProperty(properties, 'failed-targets-json'),
    failedTests: stringArrayProperty(properties, 'failed-tests-json'),
    failures: failuresProperty(properties),
    timing: {
      cpuMs: numberProperty(properties, 'timing-cpu-ms'),
      wallMs: numberProperty(properties, 'timing-wall-ms'),
      analysisMs: numberProperty(properties, 'timing-analysis-ms'),
      executionMs: numberProperty(properties, 'timing-execution-ms'),
    },
    actionSummary: {
      actionsCreated: totalActions,
      actionsExecuted,
      topMnemonics: actionMnemonicsProperty(properties),
      runners: runnersProperty(properties),
    },
    workerSummary: {
      total: numberProperty(properties, 'workers-total') || workers.length,
      killedDueToMemoryPressure: numberProperty(properties, 'workers-killed-due-to-memory-pressure'),
      peakMemoryKb: numberProperty(properties, 'workers-peak-memory-kb'),
      workers,
    },
    network: {
      bytesSent: numberProperty(properties, 'network-bytes-sent'),
      bytesRecv: numberProperty(properties, 'network-bytes-recv'),
      peakBytesSentPerSec: numberProperty(properties, 'network-peak-bytes-sent-per-sec'),
      peakBytesRecvPerSec: numberProperty(properties, 'network-peak-bytes-recv-per-sec'),
    },
    metadata: { ...buildMetadata, ...properties },
  }
}

function lastObservedTime(invocation: BzBusInvocation): number {
  const firstObserved = numberProperty(invocation.metadata, 'first-observed-at-unix-ms')
  const lastObserved = numberProperty(invocation.metadata, 'last-observed-at-unix-ms')
  return Math.max(lastObserved, firstObserved, invocation.startedAtUnixMs)
}

function isStale(invocation: BzBusInvocation): boolean {
  const lastObserved = lastObservedTime(invocation)
  return lastObserved > 0 && Date.now() - lastObserved > ACTIVE_STALE_MS
}

function isActive(invocation: BzBusInvocation): boolean {
  if (invocation.endedAtUnixMs > 0 || isStale(invocation)) return false
  return invocation.status !== 'finished'
    && invocation.status !== 'failed'
    && invocation.outcome !== 'success'
    && invocation.outcome !== 'failure'
}

function observedTime(invocation: BzBusInvocation): number {
  return Math.max(invocation.endedAtUnixMs, lastObservedTime(invocation))
}

function compareInvocations(left: BzBusInvocation, right: BzBusInvocation): number {
  const active = Number(isActive(right)) - Number(isActive(left))
  if (active !== 0) return active

  const time = observedTime(right) - observedTime(left)
  if (time !== 0) return time

  const sequence = right.lastSequenceNumber - left.lastSequenceNumber
  if (sequence !== 0) return sequence

  return right.id.localeCompare(left.id)
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function initBzBus(): BzBusService {
  const client = new LocusDbusClient()
  const state$ = new BehaviorSubject<BzBusState>(DEFAULT_STATE)
  const propertiesBySubject = new Map<string, Record<string, string>>()
  const unsubscribers: Unsubscribe[] = []
  let refreshInFlight = false

  const publish = (update: Partial<BzBusState>) => {
    state$.next({ ...state$.value, ...update, updatedAtUnixMs: Date.now() })
  }

  const publishFromStore = () => {
    const invocations = [...propertiesBySubject.entries()]
      .map(([subject, properties]) => invocationFromProperties(subject, properties))
      .sort(compareInvocations)

    publish({
      connected: true,
      latest: invocations[0] ?? null,
      invocations,
      resources: null,
      error: '',
    })
  }

  const hydrateSubject = async (subject: string) => {
    const properties = await client.properties(subject)
    if (properties.kind !== BUILD_KIND) {
      propertiesBySubject.delete(subject)
      publishFromStore()
      return
    }

    propertiesBySubject.set(subject, properties)
    publishFromStore()
  }

  const refresh = () => {
    if (refreshInFlight) return
    refreshInFlight = true

    client.findSubjects('kind', BUILD_KIND)
      .then(async subjects => {
        const next = new Map<string, Record<string, string>>()
        await Promise.all(subjects.map(async subject => {
          const properties = await client.properties(subject)
          if (properties.kind === BUILD_KIND) next.set(subject, properties)
        }))
        propertiesBySubject.clear()
        next.forEach((properties, subject) => propertiesBySubject.set(subject, properties))
        publishFromStore()
      })
      .catch(error => {
        publish({ connected: false, latest: null, invocations: [], resources: null, error: formatError(error) || 'locus unavailable' })
      })
      .finally(() => {
        refreshInFlight = false
      })
  }

  const onPropertyChanged = (signal: PropertyChangedSignal) => {
    if (signal.key === 'kind') {
      if (signal.value === BUILD_KIND) {
        hydrateSubject(signal.subject).catch(error => publish({ connected: false, error: formatError(error) }))
      } else if (propertiesBySubject.delete(signal.subject)) {
        publishFromStore()
      }
      return
    }

    const properties = propertiesBySubject.get(signal.subject)
    if (!properties) return
    propertiesBySubject.set(signal.subject, { ...properties, [signal.key]: signal.value })
    publishFromStore()
  }

  const onPropertyRemoved = (signal: PropertyRemovedSignal) => {
    const properties = propertiesBySubject.get(signal.subject)
    if (!properties) return

    if (signal.key === 'kind') {
      propertiesBySubject.delete(signal.subject)
      publishFromStore()
      return
    }

    const next = { ...properties }
    delete next[signal.key]
    propertiesBySubject.set(signal.subject, next)
    publishFromStore()
  }

  unsubscribers.push(client.onPropertyChanged(onPropertyChanged))
  unsubscribers.push(client.onPropertyRemoved(onPropertyRemoved))

  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
    refresh()
    return true
  })

  refresh()

  return { state$: state$.asObservable(), refresh }
}

let service: BzBusService | null = null

export function getBzBusService(): BzBusService {
  if (!service) service = initBzBus()
  return service
}
