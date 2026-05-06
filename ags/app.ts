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
import { prepareTheme } from 'style/theming'
import { bindCommands } from 'commands'
import { getPomodoroService } from 'services/pomodoro'
import { AgentStatus, getAgentService } from 'services/agent'
import { getLocusService } from 'services/locus'
import { execAsync } from 'ags/process'
import { combineLatest, distinctUntilChanged, first, map, of, shareReplay, switchMap } from 'rxjs'
import { createRoot } from 'gnim'
import GObject from 'ags/gobject'

app.start({
  css: style,
  requestHandler: handleRequest,
  main() {
    Adw.init()
    prepareTheme()
    bindCommands()

    const locus = getLocusService()
    setupPomodoro()
    setupAgentApprovalAutoOpen()
    setupForMonitor(locus.monitors$, Bar)

    locus.activeMonitor$.pipe(first()).subscribe(initialMonitor => {
      createRoot(() => {
        OSD(binding(locus.activeMonitor$, initialMonitor))
        Rsynapse(binding(locus.activeMonitor$, initialMonitor))
        TodoPopup(binding(locus.activeMonitor$, initialMonitor))
        AgentApprovalOverlay(binding(locus.activeMonitor$, initialMonitor))
      })
    })
  },
})

type PendingAgentRequest = [string, AgentStatus]
const AGENT_SESSION_NODE_PREFIX = 'agent-session:'

function setupAgentApprovalAutoOpen() {
  const locus = getLocusService()
  let lastAutoOpenKey = ''

  const workspaceSessions$ = locus.selectedWorkspace$.pipe(
    distinctUntilChanged(),
    switchMap(workspace => {
      if (!workspace) return of({ workspace, sessionIds: [] as string[] })
      return locus.sources$(workspace, 'workspace').pipe(
        switchMap(windows => {
          const windowSubjects = [...new Set(windows.filter(subject => subject.startsWith('window:')))]
          if (windowSubjects.length === 0) return of([] as string[])
          return combineLatest(windowSubjects.map(window => locus.pathAll$('window-agent-session', window))).pipe(
            map(targets => targets.flat()),
          )
        }),
        map(targets => ({
          workspace,
          sessionIds: sessionIdsFromTargets(targets),
        })),
      )
    }),
  )

  combineLatest([workspaceSessions$, getAgentService().sessions$]).pipe(
    map(([workspaceSessions, sessions]) => ({
      workspace: workspaceSessions.workspace,
      match: pendingRequestForSessionIds(workspaceSessions.sessionIds, pendingRequests(sessions)),
    })),
    distinctUntilChanged((left, right) =>
      left.workspace === right.workspace
      && left.match?.[0] === right.match?.[0]
      && left.match?.[1].pendingPrompt === right.match?.[1].pendingPrompt,
    ),
  ).subscribe(({ workspace, match }) => {
    if (!workspace || !match) return

    const [sessionId, status] = match
    const key = autoOpenKey(sessionId, status)
    if (key === lastAutoOpenKey) return

    lastAutoOpenKey = key
    console.log(`[AgentAutoOpen] opening approvals for session=${sessionId} workspace=${workspace}`)
    approvalsUi.showFor(sessionId)
  })
}

function pendingRequests(sessions: Map<string, AgentStatus>): PendingAgentRequest[] {
  return [...sessions.entries()]
    .filter(([, status]) => status.requiresAttention && status.pendingPrompt)
}

function sessionIdsFromTargets(targets: string[]): string[] {
  return [...new Set(
    targets
      .filter(target => target.startsWith(AGENT_SESSION_NODE_PREFIX))
      .map(target => target.slice(AGENT_SESSION_NODE_PREFIX.length)),
  )]
}

function pendingRequestForSessionIds(sessionIds: string[], pending: PendingAgentRequest[]): PendingAgentRequest | null {
  const linkedSessions = new Set(sessionIds)
  return pending.find(([sessionId]) => linkedSessions.has(sessionId)) ?? null
}

function autoOpenKey(sessionId: string, status: AgentStatus) {
  return `${sessionId}:${status.pendingPrompt}`
}

function setupForMonitor(
  monitors: import('rxjs').Observable<Gdk.Monitor[]>,
  widgetFactory: (m: Gdk.Monitor) => GObject.Object,
) {
  const mmap = new Map<Gdk.Monitor, Gtk.Window>()
  monitors.pipe(diffs()).subscribe(diff => {
    diff.removed.forEach(removed => {
      const w = mmap.get(removed)
      if (w) {
        w.destroy()
        mmap.delete(removed)
      }
    })
    diff.added.forEach(m => {
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
