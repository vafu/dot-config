import Gio from 'gi://Gio?version=2.0'
import GLib from 'gi://GLib?version=2.0'
import { BehaviorSubject, Observable } from 'rxjs'

const BUS_NAME = 'com.snap.BzBus'
const OBJECT_PATH = '/com/snap/BzBus'
const IFACE = 'com.snap.BzBus1'

const BzBusIface = `
<node>
  <interface name="com.snap.BzBus1">
    <method name="ListInvocations">
      <arg type="a(sssassssxxxuuuuu)" name="invocations" direction="out"/>
    </method>
    <method name="LatestInvocation">
      <arg type="(sssassssxxxuuuuu)" name="invocation" direction="out"/>
    </method>
    <method name="GetInvocationJson">
      <arg type="s" name="id" direction="in"/>
      <arg type="s" name="json" direction="out"/>
    </method>
    <method name="ListInvocationsJson">
      <arg type="s" name="json" direction="out"/>
    </method>
    <method name="LatestInvocationJson">
      <arg type="s" name="json" direction="out"/>
    </method>
    <method name="CurrentResources">
      <arg type="(tttu)" name="resources" direction="out"/>
    </method>
    <signal name="InvocationUpdated">
      <arg type="(sssassssxxxuuuuu)" name="invocation"/>
    </signal>
  </interface>
</node>
`

const BzBusProxy = Gio.DBusProxy.makeProxyWrapper(BzBusIface)

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

function resourcesFromTuple(item: any[]): BzBusResources {
  return {
    memoryCurrentBytes: Number(item[0] ?? 0),
    memoryPeakBytes: Number(item[1] ?? 0),
    cpuUsageUsec: Number(item[2] ?? 0),
    pids: Number(item[3] ?? 0),
  }
}

function invocationFromTuple(item: any[]): BzBusInvocation {
  return {
    id: String(item[0] ?? ''),
    buildId: String(item[1] ?? ''),
    component: String(item[2] ?? ''),
    command: Array.isArray(item[3]) ? item[3].map(String) : [],
    commandName: '',
    cwd: String(item[4] ?? ''),
    workspaceDir: '',
    bazelVersion: '',
    serverPid: 0,
    status: String(item[5] ?? ''),
    outcome: String(item[6] ?? ''),
    exitCode: 0,
    exitCodeName: '',
    startedAtUnixMs: Number(item[7] ?? 0),
    endedAtUnixMs: Number(item[8] ?? 0),
    lastSequenceNumber: Number(item[9] ?? 0),
    recentStdout: '',
    recentStderr: '',
    buildProgress: DEFAULT_BUILD_PROGRESS,
    targetsTotal: Number(item[10] ?? 0),
    targetsFailed: Number(item[11] ?? 0),
    testsTotal: Number(item[12] ?? 0),
    testsFailed: Number(item[13] ?? 0),
    actionsTotal: 0,
    actionsFailed: Number(item[14] ?? 0),
    failedTargets: [],
    failedTests: [],
    failures: [],
    timing: DEFAULT_TIMING,
    actionSummary: DEFAULT_ACTION_SUMMARY,
    workerSummary: DEFAULT_WORKER_SUMMARY,
    network: DEFAULT_NETWORK,
    metadata: {},
  }
}

function call(proxy: any, method: string, args: GLib.Variant | null = null): any[] | null {
  try {
    const variant = proxy.call_sync(
      method,
      args,
      Gio.DBusCallFlags.NONE,
      500,
      null,
    )
    return variant.deep_unpack() as any[]
  } catch (e) {
    return null
  }
}

function normalizeStatus(value: unknown): string {
  return String(value ?? '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

function parseInvocations(json: unknown): BzBusInvocation[] {
  if (typeof json !== 'string' || json.length === 0) return []
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeInvocation)
  } catch (e) {
    return []
  }
}

function parseInvocation(json: unknown): BzBusInvocation | null {
  if (typeof json !== 'string' || json.length === 0) return null
  try {
    return normalizeInvocation(JSON.parse(json))
  } catch (e) {
    return null
  }
}

function parseBuildProgress(value: unknown): BzBusBuildProgress {
  if (typeof value !== 'string' || value.length === 0) return DEFAULT_BUILD_PROGRESS

  let latest = DEFAULT_BUILD_PROGRESS
  const clean = stripAnsi(value).replace(/\r/g, '\n')
  for (const line of clean.split('\n')) {
    const progress = parseBuildProgressLine(line)
    if (progress.total > 0) latest = progress
  }
  return latest
}

function parseBuildProgressLine(value: string): BzBusBuildProgress {
  const line = value.trim()
  const match = line.match(/\[\s*([\d,]+)\s*\/\s*([\d,]+)\s*\]\s*(.*)$/)
  if (!match) return DEFAULT_BUILD_PROGRESS

  const suffix = match[3] ?? ''
  return {
    completed: parseProgressNumber(match[1]),
    total: parseProgressNumber(match[2]),
    actions: parseProgressNumber(suffix.match(/([\d,]+)\s+actions?/)?.[1] ?? ''),
    running: parseProgressNumber(suffix.match(/([\d,]+)\s+running/)?.[1] ?? ''),
    line,
  }
}

function parseProgressNumber(value: string): number {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
}

function normalizeInvocation(raw: any): BzBusInvocation {
  const timing = raw?.timing ?? {}
  const actionSummary = raw?.action_summary ?? {}
  const workerSummary = raw?.worker_summary ?? {}
  const network = raw?.network ?? {}
  const buildProgress = raw?.build_progress ?? parseBuildProgress(raw?.progress_stderr ?? raw?.recent_stderr ?? raw?.progress_stdout ?? raw?.recent_stdout ?? '')

  return {
    id: String(raw?.id ?? ''),
    buildId: String(raw?.build_id ?? ''),
    component: String(raw?.component ?? ''),
    command: Array.isArray(raw?.command) ? raw.command.map(String) : [],
    commandName: String(raw?.command_name ?? ''),
    cwd: String(raw?.cwd ?? ''),
    workspaceDir: String(raw?.workspace_dir ?? ''),
    bazelVersion: String(raw?.bazel_version ?? ''),
    serverPid: Number(raw?.server_pid ?? 0),
    status: normalizeStatus(raw?.status),
    outcome: normalizeStatus(raw?.outcome),
    exitCode: Number(raw?.exit_code ?? 0),
    exitCodeName: String(raw?.exit_code_name ?? ''),
    startedAtUnixMs: Number(raw?.started_at_unix_ms ?? 0),
    endedAtUnixMs: Number(raw?.ended_at_unix_ms ?? 0),
    lastSequenceNumber: Number(raw?.last_sequence_number ?? 0),
    recentStdout: String(raw?.recent_stdout ?? ''),
    recentStderr: String(raw?.recent_stderr ?? ''),
    buildProgress: {
      ...DEFAULT_BUILD_PROGRESS,
      completed: Number(buildProgress?.completed ?? 0),
      total: Number(buildProgress?.total ?? 0),
      actions: Number(buildProgress?.actions ?? 0),
      running: Number(buildProgress?.running ?? 0),
      line: String(buildProgress?.line ?? ''),
    },
    targetsTotal: Number(raw?.targets_total ?? 0),
    targetsFailed: Number(raw?.targets_failed ?? 0),
    testsTotal: Number(raw?.tests_total ?? 0),
    testsFailed: Number(raw?.tests_failed ?? 0),
    actionsTotal: Number(raw?.actions_total ?? 0),
    actionsFailed: Number(raw?.actions_failed ?? 0),
    failedTargets: Array.isArray(raw?.failed_targets) ? raw.failed_targets.map(String) : [],
    failedTests: Array.isArray(raw?.failed_tests) ? raw.failed_tests.map(String) : [],
    failures: Array.isArray(raw?.failures) ? raw.failures.map(normalizeFailure) : [],
    timing: {
      ...DEFAULT_TIMING,
      cpuMs: Number(timing.cpu_ms ?? 0),
      wallMs: Number(timing.wall_ms ?? 0),
      analysisMs: Number(timing.analysis_ms ?? 0),
      executionMs: Number(timing.execution_ms ?? 0),
    },
    actionSummary: {
      ...DEFAULT_ACTION_SUMMARY,
      actionsCreated: Number(actionSummary.actions_created ?? 0),
      actionsExecuted: Number(actionSummary.actions_executed ?? 0),
      topMnemonics: Array.isArray(actionSummary.top_mnemonics)
        ? actionSummary.top_mnemonics.map((item: any) => ({
          mnemonic: String(item?.mnemonic ?? ''),
          actionsExecuted: Number(item?.actions_executed ?? 0),
        }))
        : [],
      runners: Array.isArray(actionSummary.runners)
        ? actionSummary.runners.map((runner: any) => ({
          name: String(runner?.name ?? ''),
          count: Number(runner?.count ?? 0),
          execKind: String(runner?.exec_kind ?? ''),
        }))
        : [],
    },
    workerSummary: {
      ...DEFAULT_WORKER_SUMMARY,
      total: Number(workerSummary.total ?? 0),
      killedDueToMemoryPressure: Number(workerSummary.killed_due_to_memory_pressure ?? 0),
      peakMemoryKb: Number(workerSummary.peak_memory_kb ?? 0),
    },
    network: {
      ...DEFAULT_NETWORK,
      bytesSent: Number(network.bytes_sent ?? 0),
      bytesRecv: Number(network.bytes_recv ?? 0),
      peakBytesSentPerSec: Number(network.peak_bytes_sent_per_sec ?? 0),
      peakBytesRecvPerSec: Number(network.peak_bytes_recv_per_sec ?? 0),
    },
    metadata: raw?.metadata ?? {},
  }
}

function normalizeFailure(raw: any): BzBusFailure {
  return {
    kind: String(raw?.kind ?? ''),
    label: String(raw?.label ?? ''),
    mnemonic: String(raw?.mnemonic ?? ''),
    exitCode: Number(raw?.exit_code ?? 0),
    message: String(raw?.message ?? ''),
    stdout: String(raw?.stdout ?? ''),
    stderr: String(raw?.stderr ?? ''),
  }
}

function initBzBus(): BzBusService {
  const state$ = new BehaviorSubject<BzBusState>(DEFAULT_STATE)
  const proxy = BzBusProxy(Gio.DBus.session, BUS_NAME, OBJECT_PATH)

  const publish = (update: Partial<BzBusState>) => {
    state$.next({ ...state$.value, ...update, updatedAtUnixMs: Date.now() })
  }

  const refresh = () => {
    const listResult = call(proxy, 'ListInvocationsJson')
    const tupleResult = listResult ? null : call(proxy, 'ListInvocations')
    if (!listResult && !tupleResult) {
      publish({ connected: false, latest: null, invocations: [], resources: null, error: 'bzbus unavailable' })
      return
    }

    let invocations = listResult
      ? parseInvocations(listResult[0])
      : (tupleResult?.[0] ?? []).map((item: any[]) => invocationFromTuple(item))
    if (!listResult && invocations[0]?.id) {
      const latestJson = call(proxy, 'GetInvocationJson', new GLib.Variant('(s)', [invocations[0].id]))
      const latest = parseInvocation(latestJson?.[0])
      if (latest) invocations = [latest, ...invocations.slice(1).filter(invocation => invocation.id !== latest.id)]
    }
    const resourceResult = call(proxy, 'CurrentResources')
    publish({
      connected: true,
      latest: invocations[0] ?? null,
      invocations,
      resources: resourceResult ? resourcesFromTuple(resourceResult[0] ?? []) : null,
      error: listResult ? '' : 'bzbus restart pending for rich data',
    })
  }

  Gio.DBus.session.signal_subscribe(
    BUS_NAME,
    IFACE,
    'InvocationUpdated',
    OBJECT_PATH,
    null,
    Gio.DBusSignalFlags.NONE,
    () => refresh(),
  )

  Gio.DBus.session.signal_subscribe(
    'org.freedesktop.DBus',
    'org.freedesktop.DBus',
    'NameOwnerChanged',
    '/org/freedesktop/DBus',
    BUS_NAME,
    Gio.DBusSignalFlags.NONE,
    (_conn: any, _sender: any, _path: string, _iface: string, _signal: string, params: any) => {
      const [_name, _oldOwner, newOwner] = params.deepUnpack() as [string, string, string]
      if (newOwner) {
        refresh()
      } else {
        publish({ connected: false, latest: null, invocations: [], resources: null, error: 'bzbus unavailable' })
      }
    },
  )

  refresh()

  return { state$, refresh }
}

let service: BzBusService | null = null

export function getBzBusService(): BzBusService {
  if (!service) service = initBzBus()
  return service
}
