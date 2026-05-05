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
import obtainWmService from 'services'
import { bindCommands } from 'commands'
import { MonitorService } from 'services/wm/types'
import { getPomodoroService } from 'services/pomodoro'
import { AgentStatus, getAgentService } from 'services/agent'
import { getLocusService } from 'services/locus'
import { execAsync } from 'ags/process'
import { combineLatest, distinctUntilChanged, first, map, shareReplay, switchMap } from 'rxjs'
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
      setupLocusActiveProjectFromWorkspace()
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

type PendingAgentRequest = [string, AgentStatus]
const AGENT_SESSION_NODE_PREFIX = 'agent-session:'
const AGENT_SESSION_RELATION = 'agent-session'

function setupLocusActiveProjectFromWorkspace() {
  obtainWmService('workspace').then(ws => {
    const locus = getLocusService()
    let lastProject = ''

    ws.activeWorkspace.pipe(
      map(workspace => workspace.wsId),
      distinctUntilChanged(),
    ).subscribe(workspaceId => {
      if (!workspaceId) return

      const workspaceSubject = `niri:workspace:${workspaceId}`
      locus.getTargets(workspaceSubject, 'project', targets => {
        const project = targets.find(target => target.startsWith('project:')) ?? ''
        if (!project) {
          if (lastProject) {
            lastProject = ''
            console.log(`[Locus] clearing active project for workspace=${workspaceId}`)
            locus.clearContextLink('active', 'project')
          }
          return
        }
        if (project === lastProject) return

        lastProject = project
        console.log(`[Locus] active project from workspace=${workspaceId}: ${project}`)
        locus.setContextLink('active', 'project', project)
      })
    })
  }).catch(e => console.error('[Locus] active project setup failed:', e))
}

function setupAgentApprovalAutoOpen() {
  Promise.all([obtainWmService('workspace'), obtainWmService('window')]).then(([ws, windowService]) => {
    const locus = getLocusService()
    const activeWorkspaceWindows = ws.activeWorkspace.pipe(
      map(workspace => workspace.wsId),
      distinctUntilChanged(),
      switchMap(workspaceId =>
        windowService.getFor(workspaceId, 0).pipe(
          map(windows => ({ workspaceId, windows })),
        ),
      ),
    )

    let lastAutoOpenKey = ''
    let lookupSeq = 0
    combineLatest([activeWorkspaceWindows, getAgentService().sessions$]).subscribe(([workspace, sessions]) => {
      const pending = pendingRequests(sessions)
      if (!workspace.workspaceId || workspace.windows.length === 0 || pending.length === 0) {
        lookupSeq++
        return
      }

      const seq = ++lookupSeq
      findPendingRequestForWindows(locus, workspace.windows.map(window => window.id), pending, match => {
        if (seq !== lookupSeq || !match) return

        const [sessionId, status] = match
        const key = autoOpenKey(sessionId, status)
        if (key === lastAutoOpenKey) return

        lastAutoOpenKey = key
        console.log(`[AgentAutoOpen] opening approvals for session=${sessionId} workspace=${workspace.workspaceId}`)
        approvalsUi.showFor(sessionId)
      })
    })
  }).catch(e => console.error('[Agent] approval auto-open setup failed:', e))
}

function pendingRequests(sessions: Map<string, AgentStatus>): PendingAgentRequest[] {
  return [...sessions.entries()]
    .filter(([, status]) => status.requiresAttention && status.pendingPrompt)
}

function pendingRequestForSessionSubjects(
  targets: string[],
  pending: PendingAgentRequest[],
): PendingAgentRequest | null {
  const linkedSessions = new Set(
    targets
      .filter(target => target.startsWith(AGENT_SESSION_NODE_PREFIX))
      .map(target => target.slice(AGENT_SESSION_NODE_PREFIX.length)),
  )
  return pending.find(([sessionId]) => linkedSessions.has(sessionId)) ?? null
}

function findPendingRequestForWindows(
  locus: ReturnType<typeof getLocusService>,
  windowIds: string[],
  pending: PendingAgentRequest[],
  callback: (match: PendingAgentRequest | null) => void,
) {
  const ids = [...new Set(windowIds.filter(id => id && id !== '0x0'))]
  if (ids.length === 0) {
    callback(null)
    return
  }

  const targets: string[] = []
  let remaining = ids.length
  for (const windowId of ids) {
    locus.getTargets(`niri:window:${windowId}`, AGENT_SESSION_RELATION, windowTargets => {
      targets.push(...windowTargets)
      remaining--
      if (remaining === 0) {
        callback(pendingRequestForSessionSubjects(targets, pending))
      }
    })
  }
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
