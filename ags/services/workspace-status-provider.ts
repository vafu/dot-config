import Gdk from 'gi://Gdk?version=4.0'
import {
  Observable,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  scan,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs'
import { AgentStatus, getAgentService } from 'services/agent'
import { firstProjectName, workspace$, workspaceExternalId } from 'services/locus'
import { NodeListDiffCommand, locus } from 'services/locus.generated'

export type WorkspaceWindowIndicatorBase = {
  id: string
  icon: string
  active: boolean
  urgent: boolean
  x: number
  y: number
  width: number
  height: number
  cssClasses: string[]
}

export type WindowExtras =
  | { type: 'plain' }
  | {
      type: 'agent'
      sessionId: string
      state: string
      requiresAttention: boolean
      taskComplete: boolean
      substatusCount: number
    }
  | {
      type: 'neovim'
      cwd?: string
      mode?: string
    }

export type WorkspaceWindowIndicatorModel = WorkspaceWindowIndicatorBase & WindowExtras

export type WorkspaceWindowSummaryModel = {
  count: number
  activeCount: number
  hasUrgent: boolean
}

export type WorkspaceChildSpec = {
  id: string
  kind: string
  cssClasses: string[]
}

export type WorkspaceModel = {
  id: string
  key: string
  sortIndex: number
  active: boolean
  cssClasses: string[]
  collapsedIcon: string
  primaryText: string
  secondaryText: string
  secondaryVisible: boolean
  tooltip: string
  windows: WorkspaceWindowIndicatorModel[]
  windowSummary: WorkspaceWindowSummaryModel
  children: WorkspaceChildSpec[]
}

type ProjectAgent = {
  sessionId: string
  status: AgentStatus
  project: string
}

type Aggregate = {
  count: number
  hasAttention: boolean
  allIdle: boolean
  hasWorking: boolean
  hasComplete: boolean
}

const providers = new Map<string, WorkspaceStatusProvider>()
const { sessions$ } = getAgentService()

const sameArray = (left: string[], right: string[]) =>
  left.length === right.length
  && left.every((value, index) => value === right[index])

const sameChildren = (left: WorkspaceChildSpec[], right: WorkspaceChildSpec[]) =>
  left.length === right.length
  && left.every((value, index) =>
    value.id === right[index].id
    && value.kind === right[index].kind
    && sameArray(value.cssClasses, right[index].cssClasses),
  )

const sameWindow = (left: WorkspaceWindowIndicatorModel, right: WorkspaceWindowIndicatorModel) =>
  left.id === right.id
  && left.icon === right.icon
  && left.active === right.active
  && left.urgent === right.urgent
  && left.x === right.x
  && left.y === right.y
  && left.width === right.width
  && left.height === right.height
  && sameArray(left.cssClasses, right.cssClasses)
  && left.type === right.type

const sameWindows = (left: WorkspaceWindowIndicatorModel[], right: WorkspaceWindowIndicatorModel[]) =>
  left.length === right.length
  && left.every((value, index) => sameWindow(value, right[index]))

const sameWindowSummary = (
  left: WorkspaceWindowSummaryModel,
  right: WorkspaceWindowSummaryModel,
) =>
  left.count === right.count
  && left.activeCount === right.activeCount
  && left.hasUrgent === right.hasUrgent

const sameModel = (left: WorkspaceModel, right: WorkspaceModel) =>
  left.id === right.id
  && left.key === right.key
  && left.sortIndex === right.sortIndex
  && left.active === right.active
  && sameArray(left.cssClasses, right.cssClasses)
  && left.collapsedIcon === right.collapsedIcon
  && left.primaryText === right.primaryText
  && left.secondaryText === right.secondaryText
  && left.secondaryVisible === right.secondaryVisible
  && left.tooltip === right.tooltip
  && sameWindows(left.windows, right.windows)
  && sameWindowSummary(left.windowSummary, right.windowSummary)
  && sameChildren(left.children, right.children)

const sameModels = (left: WorkspaceModel[], right: WorkspaceModel[]) =>
  left.length === right.length
  && left.every((value, index) => sameModel(value, right[index]))

const projectDisplayIcon = (properties: Record<string, string>) =>
  properties['display-icon']
  || properties.icon
  || properties['icon-name']
  || properties.symbolicIcon
  || 'folder_code'

const projectTitleParts = (project: string, properties: Record<string, string>) => {
  const name = firstProjectName(project, properties).trim()
  const subproj = (properties.subproj || '').trim()
  const task = (properties.task || '').trim()
  const branch = (properties.branch || '').trim()

  if (subproj && task) return [subproj, task]
  if (subproj) return [name, subproj]
  return [name, branch]
}

const isWorking = (status: AgentStatus) =>
  status.state === 'thinking'
  || status.state === 'tool-use'
  || status.state === 'compacting'

const aggregateAgents = (agents: ProjectAgent[]): Aggregate => {
  const count = agents.length
  return {
    count,
    hasAttention: agents.some(agent => agent.status.requiresAttention),
    allIdle: count > 0 && agents.every(agent => agent.status.state === 'idle'),
    hasWorking: agents.some(agent => isWorking(agent.status)),
    hasComplete: agents.some(agent => agent.status.taskComplete),
  }
}

const projectTooltip = (
  workspaceId: string,
  workspaceName: string,
  project: string,
  properties: Record<string, string>,
  agents: ProjectAgent[],
) => {
  const metadata = Object.entries(properties)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${value}`)
  const agentLines = agents.map(agent => {
    const name = agent.status.agentNickname || agent.status.agentName || agent.sessionId
    const state = agent.status.taskComplete ? 'complete' : agent.status.state
    return `${name}: ${state}`
  })
  return [`${workspaceName} (${workspaceId})`, project, ...metadata, ...agentLines].join('\n')
}

function applyNodeListDiff(current: string[], commands: NodeListDiffCommand[]) {
  let next = [...current]
  for (const command of commands) {
    if (command.type === 'reset') {
      next = [...command.nodes]
    } else if (command.type === 'node-added') {
      const index = Math.max(0, Math.min(command.index, next.length))
      if (!next.includes(command.node)) next.splice(index, 0, command.node)
    } else if (command.type === 'node-removed') {
      const exact = next[command.index] === command.node ? command.index : next.indexOf(command.node)
      if (exact >= 0) next.splice(exact, 1)
    }
  }
  return next
}

function workspaceIdsForOutput$(connector: string) {
  return locus.sourcesDiff$(`output:${connector}`, 'output').pipe(
    scan(applyNodeListDiff, [] as string[]),
    map(subjects => subjects.filter(subject => subject.startsWith('workspace:'))),
    distinctUntilChanged(sameArray),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
}

function workspaceWindows$(workspaceId: string): Observable<WorkspaceWindowIndicatorModel[]> {
  return workspace$(workspaceId).tabs.pipe(
    switchMap(tabs => {
      if (tabs.length === 0) return of([] as WorkspaceWindowIndicatorModel[])

      return combineLatest(tabs.map(tab =>
        combineLatest([
          tab.icon.pipe(startWith('')),
          tab.isActive.pipe(startWith(false)),
          locus.booleanProperty$(tab.subject, 'urgent').pipe(startWith(false)),
        ]).pipe(
          map(([icon, active, urgent]) => ({
            id: tab.subject,
            icon,
            active,
            urgent,
            x: tab.xValue,
            y: tab.yValue,
            width: tab.widthValue,
            height: tab.heightValue,
            cssClasses: [
              'workspace-window-indicator',
              active ? 'active' : '',
              urgent ? 'urgent' : '',
            ].filter(Boolean),
            type: 'plain',
          } as WorkspaceWindowIndicatorModel)),
        ),
      ))
    }),
    map(windows => [...windows].sort((left, right) =>
      left.x - right.x
      || left.y - right.y
      || left.id.localeCompare(right.id),
    )),
    distinctUntilChanged(sameWindows),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
}

const windowSummary = (windows: WorkspaceWindowIndicatorModel[]) => ({
  count: windows.length,
  activeCount: windows.filter(window => window.active).length,
  hasUrgent: windows.some(window => window.urgent),
})

const sessionIds$ = sessions$.pipe(
  map(sessions => [...sessions.keys()].sort()),
  distinctUntilChanged(sameArray),
  shareReplay({ bufferSize: 1, refCount: true }),
)

const sessionProjects$ = sessionIds$.pipe(
  switchMap(sessionIds => {
    if (sessionIds.length === 0) return of(new Map<string, string>())

    return combineLatest(
      sessionIds.map(sessionId => {
        const node = `agent-session:${sessionId}`
        return combineLatest([
          locus.agentSessionWorkspaceProjectString$(node),
          locus.agentSessionProjectString$(node),
        ]).pipe(
          map(([workspaceProject, directProject]) =>
            [sessionId, workspaceProject || directProject] as const,
          ),
        )
      }),
    ).pipe(
      map(entries => new Map<string, string>(entries)),
    )
  }),
  shareReplay({ bufferSize: 1, refCount: true }),
)

const projectAgents$ = combineLatest([sessions$, sessionProjects$]).pipe(
  map(([sessions, projects]) =>
    [...sessions.entries()]
      .map(([sessionId, status]) => ({
        sessionId,
        status,
        project: projects.get(sessionId) ?? '',
      }))
      .filter(item => !!item.project)
      .sort((left, right) =>
        Number(left.status.isSubagent) - Number(right.status.isSubagent)
        || left.sessionId.localeCompare(right.sessionId),
      ),
  ),
  shareReplay({ bufferSize: 1, refCount: true }),
)

function workspaceModel$(workspaceId: string): Observable<WorkspaceModel> {
  return combineLatest([
    locus.properties$(workspaceId),
    locus.selectedWorkspaceString$(),
    locus.targets$(workspaceId, 'project'),
    projectAgents$,
    workspaceWindows$(workspaceId),
  ]).pipe(
    switchMap(([workspaceProperties, selectedWorkspace, projects, projectAgents, windows]) => {
      const project = projects[0] ?? ''
      const sortIndex = Number(workspaceProperties.index) || workspaceExternalId(workspaceId)
      const workspaceName = workspaceProperties.name || `${sortIndex || workspaceExternalId(workspaceId)}`
      const active = selectedWorkspace === workspaceId
      const summary = windowSummary(windows)

      if (!project) {
        return of({
          id: workspaceId,
          key: workspaceId,
          sortIndex,
          active,
          cssClasses: [
            'workspaces-workspace',
            'projects-project',
            active ? 'current-workspace' : '',
            workspaceProperties.urgent === 'true' ? 'has-attention' : '',
          ].filter(Boolean),
          collapsedIcon: 'view_quilt',
          primaryText: workspaceName,
          secondaryText: '',
          secondaryVisible: false,
          tooltip: `${workspaceName} (${workspaceId})`,
          windows,
          windowSummary: summary,
          children: [],
        })
      }

      return locus.properties$(project).pipe(
        map(projectProperties => {
          const agents = projectAgents.filter(agent => agent.project === project)
          const aggregate = aggregateAgents(agents)
          const [primaryText, secondaryText] = projectTitleParts(project, projectProperties)
          return {
            id: workspaceId,
            key: workspaceId,
            sortIndex,
            active,
            cssClasses: [
              'workspaces-workspace',
              'projects-project',
              active ? 'current-workspace' : '',
              aggregate.hasAttention ? 'has-attention' : '',
              aggregate.allIdle ? 'all-idle' : '',
              aggregate.hasWorking ? 'has-working' : '',
              aggregate.hasComplete ? 'has-complete' : '',
            ].filter(Boolean),
            collapsedIcon: projectDisplayIcon(projectProperties),
            primaryText,
            secondaryText,
            secondaryVisible: !!secondaryText,
            tooltip: projectTooltip(workspaceId, workspaceName, project, projectProperties, agents),
            windows,
            windowSummary: summary,
            children: agents.map(agent => ({
              id: agent.sessionId,
              kind: 'agent-session',
              cssClasses: [],
            })),
          }
        }),
      )
    }),
    distinctUntilChanged(sameModel),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
}

export class WorkspaceStatusProvider {
  readonly models$: Observable<WorkspaceModel[]>

  static forMonitor(monitor: Gdk.Monitor) {
    const connector = monitor.connector
    let provider = providers.get(connector)
    if (!provider) {
      provider = new WorkspaceStatusProvider(connector)
      providers.set(connector, provider)
    }
    return provider
  }

  private constructor(connector: string) {
    this.models$ = workspaceIdsForOutput$(connector).pipe(
      switchMap(workspaceIds => {
        if (workspaceIds.length === 0) return of([] as WorkspaceModel[])
        return combineLatest(workspaceIds.map(workspaceModel$))
      }),
      map(models => [...models].sort((left, right) =>
        left.sortIndex - right.sortIndex
        || workspaceExternalId(left.id) - workspaceExternalId(right.id),
      )),
      distinctUntilChanged(sameModels),
      shareReplay({ bufferSize: 1, refCount: true }),
    )
  }

  childSubstatusCount$(childId: string) {
    return locus.targets$(`agent-session:${childId}`, 'subagent-session').pipe(
      map(children => children.length),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    )
  }
}
