import Gio from 'gi://Gio?version=2.0'
import GLib from 'gi://GLib?version=2.0'
import { BehaviorSubject, Observable } from 'rxjs'

const BUS_NAME = 'com.anthropic.ClaudeCode'
const STATS_PATH = '/com/anthropic/ClaudeCode/stats'
const STATS_IFACE = 'com.anthropic.ClaudeCode1.Stats'
const PROPS_IFACE = 'org.freedesktop.DBus.Properties'

export interface DailyActivity {
  date: string
  messages: number
  sessions: number
  toolCalls: number
}

export interface DailyTokens {
  date: string
  tokens: number
}

export interface ModelUsage {
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  webSearches: number
}

export interface ClaudeStatsData {
  totalSessions: number
  totalMessages: number
  firstSessionDate: string
  totalSpeculationMs: number
  longestSessionId: string
  longestSessionDurationMs: number
  longestSessionMessages: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheCreationTokens: number
  modelUsage: ModelUsage[]
  dailyActivity: DailyActivity[]
  dailyTokens: DailyTokens[]
}

export interface ClaudeStatsService {
  stats$: Observable<ClaudeStatsData>
}

const DEFAULT: ClaudeStatsData = {
  totalSessions: 0,
  totalMessages: 0,
  firstSessionDate: '',
  totalSpeculationMs: 0,
  longestSessionId: '',
  longestSessionDurationMs: 0,
  longestSessionMessages: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheReadTokens: 0,
  totalCacheCreationTokens: 0,
  modelUsage: [],
  dailyActivity: [],
  dailyTokens: [],
}

function propsToStats(props: Record<string, GLib.Variant>): Partial<ClaudeStatsData> {
  const s: Partial<ClaudeStatsData> = {}
  if ('TotalSessions' in props) s.totalSessions = props['TotalSessions'].deepUnpack() as number
  if ('TotalMessages' in props) s.totalMessages = props['TotalMessages'].deepUnpack() as number
  if ('FirstSessionDate' in props) s.firstSessionDate = props['FirstSessionDate'].deepUnpack() as string
  if ('TotalSpeculationMs' in props) s.totalSpeculationMs = props['TotalSpeculationMs'].deepUnpack() as number
  if ('LongestSessionId' in props) s.longestSessionId = props['LongestSessionId'].deepUnpack() as string
  if ('LongestSessionDurationMs' in props) s.longestSessionDurationMs = props['LongestSessionDurationMs'].deepUnpack() as number
  if ('LongestSessionMessages' in props) s.longestSessionMessages = props['LongestSessionMessages'].deepUnpack() as number
  if ('TotalInputTokens' in props) s.totalInputTokens = props['TotalInputTokens'].deepUnpack() as number
  if ('TotalOutputTokens' in props) s.totalOutputTokens = props['TotalOutputTokens'].deepUnpack() as number
  if ('TotalCacheReadTokens' in props) s.totalCacheReadTokens = props['TotalCacheReadTokens'].deepUnpack() as number
  if ('TotalCacheCreationTokens' in props) s.totalCacheCreationTokens = props['TotalCacheCreationTokens'].deepUnpack() as number
  if ('ModelUsage' in props) {
    const rows = props['ModelUsage'].deepUnpack() as [string, number, number, number, number, number][]
    s.modelUsage = rows.map(([model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, webSearches]) =>
      ({ model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, webSearches }))
  }
  if ('DailyActivity' in props) {
    const rows = props['DailyActivity'].deepUnpack() as [string, number, number, number][]
    s.dailyActivity = rows.map(([date, messages, sessions, toolCalls]) => ({ date, messages, sessions, toolCalls }))
  }
  if ('DailyTokens' in props) {
    const rows = props['DailyTokens'].deepUnpack() as [string, number][]
    s.dailyTokens = rows.map(([date, tokens]) => ({ date, tokens }))
  }
  return s
}

let service: ClaudeStatsService | null = null

export function getClaudeStatsService(): ClaudeStatsService {
  if (service) return service

  const stats$ = new BehaviorSubject<ClaudeStatsData>({ ...DEFAULT })

  const update = (partial: Partial<ClaudeStatsData>) => {
    stats$.next({ ...stats$.value, ...partial })
  }

  // Subscribe to PropertiesChanged
  Gio.DBus.session.signal_subscribe(
    BUS_NAME,
    PROPS_IFACE,
    'PropertiesChanged',
    STATS_PATH,
    null,
    Gio.DBusSignalFlags.NONE,
    (_conn: any, _sender: any, _path: any, _iface: any, _signal: any, params: any) => {
      const [ifaceName, changed] = params.deepUnpack() as [string, Record<string, GLib.Variant>]
      if (ifaceName !== STATS_IFACE) return
      update(propsToStats(changed))
    },
  )

  // Initial read via GetAll
  Gio.DBus.session.call(
    BUS_NAME,
    STATS_PATH,
    PROPS_IFACE,
    'GetAll',
    new GLib.Variant('(s)', [STATS_IFACE]),
    null,
    Gio.DBusCallFlags.NONE,
    -1,
    null,
    (_conn: any, res: any) => {
      try {
        const result = Gio.DBus.session.call_finish(res)
        const [props] = result.deepUnpack() as [Record<string, GLib.Variant>]
        update(propsToStats(props))
      } catch (e) {
        console.error('[ClaudeStats] GetAll error:', e)
      }
    },
  )

  service = { stats$ }
  return service
}

export function todayString(): string {
  return new Date().toISOString().split('T')[0]
}
