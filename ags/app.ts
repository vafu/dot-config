import app from 'ags/gtk4/app'
import { Gdk, Gtk } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'
import Bar from 'widgets/bar'
import style from './style/style'
import OSD from 'widgets/osd'
import { binding } from 'rxbinding'
import { diffs } from 'commons/rx'
import { Rsynapse } from 'widgets/rsynapse'
import { TodoPopup } from 'widgets/todo/input'
import { AgentApprovalOverlay } from 'widgets/agent-approvals/overlay'
import approvalsUi from 'widgets/agent-approvals'
import { handleRequest } from 'services/requests'
import { windowIdForAgentSession } from 'services/agent-session-window'
import { prepareTheme } from 'style/theming'
import obtainWmService from 'services'
import { bindCommands } from 'commands'
import { MonitorService } from 'services/wm/types'
import { getPomodoroService } from 'services/pomodoro'
import { AgentStatus, getAgentService } from 'services/agent'
import { execAsync } from 'ags/process'
import { combineLatest, distinctUntilChanged, first, map, shareReplay } from 'rxjs'
import { createRoot } from 'gnim'
import GObject from 'ags/gobject'

app.start({
  css: style,
  requestHandler: handleRequest,
  main() {
    Adw.init()
    prepareTheme()
    bindCommands()

    obtainWmService('monitor').then(ms => {
      setupPomodoro()
      setupAgentApprovalAutoOpen()
      setupForMonitor(ms, Bar)

      // Wait for first monitor emission to get initial value
      ms.activeMonitor.pipe(first()).subscribe(initialMonitor => {
        createRoot(() => {
          OSD(binding(ms.activeMonitor, initialMonitor))
          Rsynapse(binding(ms.activeMonitor, initialMonitor))
          TodoPopup(binding(ms.activeMonitor, initialMonitor))
          AgentApprovalOverlay(binding(ms.activeMonitor, initialMonitor))
        })
      })
    })
  },
})

type FocusedWindowInfo = {
  id: string
}

type PendingAgentRequest = [string, AgentStatus]

function setupAgentApprovalAutoOpen() {
  obtainWmService('window').then(ws => {
    const activeWindow = ws.active.pipe(
      map(w => ({ id: w.id }) as FocusedWindowInfo),
      distinctUntilChanged((a, b) => a.id === b.id),
    )

    let lastAutoOpenKey = ''
    combineLatest([activeWindow, getAgentService().sessions$]).subscribe(([window, sessions]) => {
      const match = pendingRequestForWindow(window, pendingRequests(sessions))
      if (!match) return

      const [sessionId, status] = match
      const key = autoOpenKey(sessionId, status)
      if (key === lastAutoOpenKey) return

      lastAutoOpenKey = key
      console.log(`[AgentAutoOpen] opening approvals for session=${sessionId} window=${window.id}`)
      approvalsUi.showFor(sessionId)
    })
  }).catch(e => console.error('[Agent] approval auto-open setup failed:', e))
}

function pendingRequests(sessions: Map<string, AgentStatus>): PendingAgentRequest[] {
  return [...sessions.entries()]
    .filter(([, status]) => status.requiresAttention && status.pendingPrompt)
}

function pendingRequestForWindow(
  window: FocusedWindowInfo,
  pending: PendingAgentRequest[],
): PendingAgentRequest | null {
  return pending.find(([sessionId]) => windowIdForAgentSession(sessionId) === window.id) ?? null
}

function autoOpenKey(sessionId: string, status: AgentStatus) {
  return `${sessionId}:${status.pendingPrompt}`
}

function setupForMonitor(
  ms: MonitorService,
  widgetFactory: (m: Gdk.Monitor) => GObject.Object,
) {
  const mmap = new Map<Gdk.Monitor, Gtk.Window>()
  ms.monitors.pipe(diffs()).subscribe(monitors => {
    monitors.removed.forEach(removed => {
      const w = mmap.get(removed)
      if (w) {
        w.destroy()
        mmap.delete(removed)
      }
    })
    monitors.added.forEach(m => {
      createRoot(() => {
        mmap.set(m, widgetFactory(m) as Gtk.Window)
      })
    })
  })
}

function setupPomodoro() {
  const state = getPomodoroService().state.pipe(shareReplay(1))
  state
    .pipe(
      map(s => s.state),
      distinctUntilChanged(),
    )
    .subscribe(s => {
      switch (s) {
        case 'pomodoro':
          dndOn()
          return
        case 'short-break':
        case 'long-break':
        case 'none':
          dndOff()
      }
    })

  state
    .pipe(
      map(s => {
        if (s.state == 'short-break' || s.state == 'long-break') {
          return s.elapsed / s.duration >= 0.5
        }
        return false
      }),
      distinctUntilChanged(),
    )
    .subscribe(notif => {
      if (notif) execAsync('./scripts/dnd.sh request break_ends')
    })
}

function dndOn() {
  execAsync('./scripts/dnd.sh on').catch()
}

function dndOff() {
  execAsync('./scripts/dnd.sh off').catch()
}
