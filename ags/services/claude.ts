import Gio from 'gi://Gio?version=2.0'
import GLib from 'gi://GLib?version=2.0'
import { BehaviorSubject, Observable } from 'rxjs'

export type ClaudeState = 'no-session' | 'idle' | 'thinking' | 'attention' | 'compacting'

export interface ClaudeStatus {
  state: ClaudeState
  contextPct: number
  modelName: string
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
}

let service: ClaudeService | null = null

export function getClaudeService(): ClaudeService {
  if (service) return service

  const sessions$ = new BehaviorSubject<Map<string, ClaudeStatus>>(new Map())
  const elicitation$ = new BehaviorSubject<ClaudeElicitation | null>(null)

  const updateSession = (sessionId: string, update: Partial<ClaudeStatus>) => {
    const map = new Map(sessions$.value)
    const current = map.get(sessionId) ?? { state: 'no-session' as ClaudeState, contextPct: 0, modelName: '' }
    map.set(sessionId, { ...current, ...update })
    sessions$.next(map)
  }

  Gio.DBus.session.signal_subscribe(
    'com.anthropic.ClaudeCode',
    'com.anthropic.ClaudeCode1',
    'StatusChanged',
    '/com/anthropic/ClaudeCode',
    null,
    Gio.DBusSignalFlags.NONE,
    (_conn: any, _sender: any, _path: any, _iface: any, _signal: any, params: any) => {
      const [sessionId, state, contextPct, modelName] = params.deepUnpack() as [string, string, number, string]
      console.log(`[Claude] StatusChanged: session=${sessionId} state=${state} ctx=${contextPct}`)
      updateSession(sessionId, { state: state as ClaudeState, contextPct, modelName })
    },
  )

  Gio.DBus.session.signal_subscribe(
    'com.anthropic.ClaudeCode',
    'com.anthropic.ClaudeCode1',
    'SessionRemoved',
    '/com/anthropic/ClaudeCode',
    null,
    Gio.DBusSignalFlags.NONE,
    (_conn: any, _sender: any, _path: any, _iface: any, _signal: any, params: any) => {
      const [sessionId] = params.deepUnpack() as [string]
      console.log(`[Claude] SessionRemoved: session=${sessionId}`)
      const map = new Map(sessions$.value)
      map.delete(sessionId)
      sessions$.next(map)
    },
  )

  Gio.DBus.session.signal_subscribe(
    'com.anthropic.ClaudeCode',
    'com.anthropic.ClaudeCode1',
    'ElicitationRequested',
    '/com/anthropic/ClaudeCode',
    null,
    Gio.DBusSignalFlags.NONE,
    (_conn: any, _sender: any, _path: any, _iface: any, _signal: any, params: any) => {
      const [sessionId, prompt, options] = params.deepUnpack() as [string, string, string[]]
      console.log(`[Claude] ElicitationRequested: session=${sessionId} prompt=${prompt}`)
      elicitation$.next({ sessionId, prompt, options })
    },
  )

  const respondToElicitation = (sessionId: string, answer: string) => {
    console.log(`[Claude] respondToElicitation: session=${sessionId} answer=${answer}`)
    elicitation$.next(null)
    Gio.DBus.session.call(
      'com.anthropic.ClaudeCode',
      '/com/anthropic/ClaudeCode',
      'com.anthropic.ClaudeCode1',
      'RespondToElicitation',
      new GLib.Variant('(ss)', [sessionId, answer]),
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

  service = { sessions$, elicitation$, respondToElicitation }
  return service
}
