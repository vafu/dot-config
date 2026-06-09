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

export interface BzBusWorkerSummary {
  total: number
  killedDueToMemoryPressure: number
  peakMemoryKb: number
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
const DEFAULT_WORKER_SUMMARY: BzBusWorkerSummary = { total: 0, killedDueToMemoryPressure: 0, peakMemoryKb: 0 }
const DEFAULT_NETWORK: BzBusNetwork = { bytesSent: 0, bytesRecv: 0, peakBytesSentPerSec: 0, peakBytesRecvPerSec: 0 }
const DEFAULT_BUILD_PROGRESS: BzBusBuildProgress = { completed: 0, total: 0, actions: 0, running: 0, line: '' }

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

function idFromSubject(subject: string): string {
  return subject.startsWith(BUILD_SUBJECT_PREFIX) ? subject.slice(BUILD_SUBJECT_PREFIX.length) : subject
}

function invocationFromProperties(subject: string, properties: Record<string, string>): BzBusInvocation {
  const actionsCompleted = numberProperty(properties, 'actions-completed')
  const totalActions = numberProperty(properties, 'total-actions')
  const progressCompleted = numberProperty(properties, 'progress-completed')
  const progressTotal = numberProperty(properties, 'progress-total')
  const runningActions = numberProperty(properties, 'running-actions')

  return {
    id: stringProperty(properties, 'id') || idFromSubject(subject),
    buildId: stringProperty(properties, 'build-id'),
    component: stringProperty(properties, 'component'),
    command: [],
    commandName: stringProperty(properties, 'command-name'),
    cwd: stringProperty(properties, 'cwd'),
    workspaceDir: stringProperty(properties, 'workspace-dir'),
    bazelVersion: stringProperty(properties, 'bazel-version'),
    serverPid: numberProperty(properties, 'server-pid'),
    status: stringProperty(properties, 'status') || 'unknown',
    outcome: stringProperty(properties, 'outcome') || 'unknown',
    exitCode: 0,
    exitCodeName: '',
    startedAtUnixMs: numberProperty(properties, 'started-at-unix-ms'),
    endedAtUnixMs: numberProperty(properties, 'ended-at-unix-ms'),
    lastSequenceNumber: numberProperty(properties, 'last-observed-sequence-number'),
    recentStdout: '',
    recentStderr: '',
    buildProgress: {
      completed: progressCompleted,
      total: progressTotal,
      actions: actionsCompleted,
      running: runningActions,
      line: '',
    },
    targetsTotal: numberProperty(properties, 'targets-total'),
    targetsFailed: numberProperty(properties, 'targets-failed'),
    testsTotal: numberProperty(properties, 'tests-total'),
    testsFailed: numberProperty(properties, 'tests-failed'),
    actionsTotal: actionsCompleted,
    actionsFailed: numberProperty(properties, 'actions-failed'),
    failedTargets: [],
    failedTests: [],
    failures: [],
    timing: DEFAULT_TIMING,
    actionSummary: {
      ...DEFAULT_ACTION_SUMMARY,
      actionsCreated: totalActions,
      actionsExecuted: actionsCompleted,
    },
    workerSummary: DEFAULT_WORKER_SUMMARY,
    network: DEFAULT_NETWORK,
    metadata: { ...properties },
  }
}

function isActive(invocation: BzBusInvocation): boolean {
  return invocation.status !== 'finished'
    && invocation.status !== 'failed'
    && invocation.outcome !== 'success'
    && invocation.outcome !== 'failure'
}

function observedTime(invocation: BzBusInvocation): number {
  const firstObserved = numberProperty(invocation.metadata, 'first-observed-at-unix-ms')
  return Math.max(invocation.endedAtUnixMs, invocation.startedAtUnixMs, firstObserved)
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
