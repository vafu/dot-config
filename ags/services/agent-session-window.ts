import GLib from 'gi://GLib?version=2.0'
import { BehaviorSubject } from 'rxjs'
import { requestsFor } from 'services/requests'

type SessionWindowRequest = {
  command: 'agent-session-window'
  '--session-id'?: string
  '--window-id'?: string
  '--remove'?: boolean
  sessionId?: string
  windowId?: string
  remove?: boolean
}

const sessionWindows = new BehaviorSubject<Map<string, string>>(new Map())

type SessionWindowUpdate = {
  sessionId: string
  windowId: string
  remove: boolean
}

export function windowIdForAgentSession(sessionId: string) {
  return sessionWindows.value.get(sessionId) ?? ''
}

function mappingPath() {
  return `${GLib.get_user_runtime_dir()}/agent-dbus/session-windows.json`
}

function loadMappings() {
  try {
    const [ok, bytes] = GLib.file_get_contents(mappingPath())
    if (!ok) return
    replaceMappings(JSON.parse(new TextDecoder().decode(bytes)) as Record<string, string>)
    console.log(`[AgentSessionWindow] loaded ${sessionWindows.value.size} session-window mappings`)
  } catch (e) {
    console.log(`[AgentSessionWindow] no saved mappings: ${e}`)
  }
}

loadMappings()

requestsFor<SessionWindowRequest>('agent-session-window').subscribe(r => {
  applyRequest(toUpdate(r.request))
  r.handler({ status: 'ok' })
})

function replaceMappings(mappings: Record<string, string>) {
  sessionWindows.next(new Map(Object.entries(mappings)))
}

function toUpdate(request: SessionWindowRequest): SessionWindowUpdate {
  return {
    sessionId: request['--session-id'] ?? request.sessionId ?? '',
    windowId: request['--window-id'] ?? request.windowId ?? '',
    remove: request['--remove'] ?? request.remove ?? false,
  }
}

function applyRequest(update: SessionWindowUpdate) {
  if (!update.sessionId) return

  const next = new Map(sessionWindows.value)
  if (update.remove) next.delete(update.sessionId)
  else if (update.windowId) next.set(update.sessionId, update.windowId)
  else return

  sessionWindows.next(next)
  console.log(`[AgentSessionWindow] ${update.remove ? 'removed' : 'mapped'} session=${update.sessionId} window=${update.windowId || '(none)'}`)
}
