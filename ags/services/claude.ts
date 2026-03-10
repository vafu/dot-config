import Gio from 'gi://Gio?version=2.0'
import GLib from 'gi://GLib?version=2.0'
import { BehaviorSubject, Observable } from 'rxjs'
import { execAsync } from 'ags/process'

export type ClaudeState = 'no-session' | 'idle' | 'thinking' | 'tool-use' | 'compacting'

export interface ClaudeStatus {
  state: ClaudeState
  taskComplete: boolean
  requiresAttention: boolean
  contextPct: number
  modelName: string
  cwd: string
  costUsd: number
}

export interface ClaudeElicitation {
  sessionId: string
  prompt: string
  options: string[]
}

export interface ClaudeService {
  sessions$: Observable<Map<string, ClaudeStatus>>
  elicitation$: Observable<ClaudeElicitation | null>
  respondToElicitation: (sessionId: string, answer: string) => void
  iconForCwd: (cwd: string) => Observable<string>
}

const BUS_NAME = 'com.anthropic.ClaudeCode'
const MANAGER_PATH = '/com/anthropic/ClaudeCode'
const SESSION_IFACE = 'com.anthropic.ClaudeCode1.Session'
const PROPS_IFACE = 'org.freedesktop.DBus.Properties'
const MANAGER_IFACE = 'org.freedesktop.DBus.ObjectManager'
const SESSION_PREFIX = '/com/anthropic/ClaudeCode/sessions/'

let service: ClaudeService | null = null

function sessionIdFromPath(path: string): string | null {
  if (!path.startsWith(SESSION_PREFIX)) return null
  return path.slice(SESSION_PREFIX.length)
}

function propsToStatus(props: Record<string, GLib.Variant>): Partial<ClaudeStatus> {
  const status: Partial<ClaudeStatus> = {}
  if ('State' in props) status.state = props['State'].deepUnpack() as ClaudeState
  if ('TaskComplete' in props) status.taskComplete = props['TaskComplete'].deepUnpack() as boolean
  if ('RequiresAttention' in props) status.requiresAttention = props['RequiresAttention'].deepUnpack() as boolean
  if ('ContextPct' in props) status.contextPct = props['ContextPct'].deepUnpack() as number
  if ('ModelName' in props) status.modelName = props['ModelName'].deepUnpack() as string
  if ('Cwd' in props) status.cwd = props['Cwd'].deepUnpack() as string
  if ('CostUsd' in props) status.costUsd = props['CostUsd'].deepUnpack() as number
  return status
}

export function getClaudeService(): ClaudeService {
  if (service) return service

  const sessions$ = new BehaviorSubject<Map<string, ClaudeStatus>>(new Map())
  const elicitation$ = new BehaviorSubject<ClaudeElicitation | null>(null)

  const DEFAULT: ClaudeStatus = { state: 'no-session', taskComplete: false, requiresAttention: false, contextPct: 0, modelName: '', cwd: '', costUsd: 0 }

  const updateSession = (sessionId: string, update: Partial<ClaudeStatus>) => {
    const map = new Map(sessions$.value)
    const current = map.get(sessionId) ?? { ...DEFAULT }
    map.set(sessionId, { ...current, ...update })
    sessions$.next(map)
  }

  const removeSession = (sessionId: string) => {
    const map = new Map(sessions$.value)
    map.delete(sessionId)
    sessions$.next(map)
  }

  // PropertiesChanged on session objects
  Gio.DBus.session.signal_subscribe(
    BUS_NAME,
    PROPS_IFACE,
    'PropertiesChanged',
    null, // any path
    null,
    Gio.DBusSignalFlags.NONE,
    (_conn: any, _sender: any, path: string, _iface: any, _signal: any, params: any) => {
      const sessionId = sessionIdFromPath(path)
      if (!sessionId) return
      const [ifaceName, changed, _invalidated] = params.deepUnpack() as [string, Record<string, GLib.Variant>, string[]]
      if (ifaceName !== SESSION_IFACE) return
      const update = propsToStatus(changed)
      console.log(`[Claude] PropertiesChanged: session=${sessionId}`, update)
      updateSession(sessionId, update)
      if (update.requiresAttention === false && elicitation$.value?.sessionId === sessionId) {
        elicitation$.next(null)
      }
    },
  )

  // InterfacesAdded — new session object registered
  Gio.DBus.session.signal_subscribe(
    BUS_NAME,
    MANAGER_IFACE,
    'InterfacesAdded',
    MANAGER_PATH,
    null,
    Gio.DBusSignalFlags.NONE,
    (_conn: any, _sender: any, _path: any, _iface: any, _signal: any, params: any) => {
      const [objectPath, interfaces] = params.deepUnpack() as [string, Record<string, Record<string, GLib.Variant>>]
      const sessionId = sessionIdFromPath(objectPath)
      if (!sessionId) return
      const props = interfaces[SESSION_IFACE]
      console.log(`[Claude] InterfacesAdded: session=${sessionId}`)
      if (props) {
        updateSession(sessionId, propsToStatus(props))
      } else {
        updateSession(sessionId, { ...DEFAULT })
      }
    },
  )

  // InterfacesRemoved — session object unregistered
  Gio.DBus.session.signal_subscribe(
    BUS_NAME,
    MANAGER_IFACE,
    'InterfacesRemoved',
    MANAGER_PATH,
    null,
    Gio.DBusSignalFlags.NONE,
    (_conn: any, _sender: any, _path: any, _iface: any, _signal: any, params: any) => {
      const [objectPath] = params.deepUnpack() as [string, string[]]
      const sessionId = sessionIdFromPath(objectPath)
      if (!sessionId) return
      console.log(`[Claude] InterfacesRemoved: session=${sessionId}`)
      removeSession(sessionId)
    },
  )

  // ElicitationRequested signal on session objects
  Gio.DBus.session.signal_subscribe(
    BUS_NAME,
    SESSION_IFACE,
    'ElicitationRequested',
    null, // any path
    null,
    Gio.DBusSignalFlags.NONE,
    (_conn: any, _sender: any, path: string, _iface: any, _signal: any, params: any) => {
      const sessionId = sessionIdFromPath(path)
      if (!sessionId) return
      const [prompt, options] = params.deepUnpack() as [string, string[]]
      console.log(`[Claude] ElicitationRequested: session=${sessionId} prompt=${prompt}`)
      elicitation$.next({ sessionId, prompt, options })
    },
  )

  // RespondToElicitation is now a method on the session object
  const respondToElicitation = (sessionId: string, answer: string) => {
    const safePath = SESSION_PREFIX + sessionId.replace(/[^a-zA-Z0-9_]/g, '_')
    console.log(`[Claude] respondToElicitation: session=${sessionId} answer=${answer}`)
    elicitation$.next(null)
    Gio.DBus.session.call(
      BUS_NAME,
      safePath,
      SESSION_IFACE,
      'RespondToElicitation',
      new GLib.Variant('(s)', [answer]),
      null,
      Gio.DBusCallFlags.NONE,
      -1,
      null,
      (_conn: any, res: any) => {
        try {
          Gio.DBus.session.call_finish(res)
        } catch (e) {
          console.error('[Claude] respondToElicitation error:', e)
        }
      },
    )
  }

  // Icon picker: cache per cwd
  const iconCache = new Map<string, BehaviorSubject<string>>()
  const iconForCwd = (cwd: string): Observable<string> => {
    if (!cwd) return new BehaviorSubject('smart_toy')
    const existing = iconCache.get(cwd)
    if (existing) return existing
    const subject = new BehaviorSubject<string>('smart_toy')
    iconCache.set(cwd, subject)
    execAsync(['pick-icon', '--json', '-n', '1', cwd])
      .then(output => {
        try {
          const results = JSON.parse(output)
          if (results.length > 0) {
            subject.next(results[0].icon)
          }
        } catch (e) {
          console.error('[Claude] pick-icon parse error:', e)
        }
      })
      .catch(e => console.error('[Claude] pick-icon error:', e))
    return subject
  }

  service = { sessions$, elicitation$, respondToElicitation, iconForCwd }
  return service
}
