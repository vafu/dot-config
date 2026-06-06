import { Gdk, Gtk } from 'ags/gtk4'
import {
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs'
import { bindAs, subscribeTo } from 'rxbinding'
import { getAgentService, AgentStatus } from 'services/agent'
import { firstProjectName, workspacesOnMonitor$ } from 'services/locus'
import { locus } from 'services/locus.generated'
import { MaterialIcon } from 'widgets/materialicon'
import { WidgetProps } from 'widgets'
import { AgentWidget } from './agent'
import { PanelButtonGroup } from './panel-widgets'

type SimpleProjectChipProps = WidgetProps & {
  icon$: Observable<string>
  primary$: Observable<string>
  secondary$: Observable<string>
  visible$: Observable<boolean>
  tooltip$: Observable<string>
}

type ProjectAgent = {
  sessionId: string
  status: AgentStatus
  project: string
}

type ProjectAggregate = {
  count: number
  hasAttention: boolean
  allIdle: boolean
  hasWorking: boolean
  hasComplete: boolean
}

type WorkspaceProject = {
  project: string
  workspaceIndex: number
}

const sameArray = (left: string[], right: string[]) =>
  left.length === right.length
  && left.every((value, index) => value === right[index])

const sameAggregate = (left: ProjectAggregate, right: ProjectAggregate) =>
  left.count === right.count
  && left.hasAttention === right.hasAttention
  && left.allIdle === right.allIdle
  && left.hasWorking === right.hasWorking
  && left.hasComplete === right.hasComplete

const selectedProject$ = locus.selectedProjectString$()
const selectedProjectProperties$ = locus.pathProperties$('selected-project')

const visible$ = selectedProject$.pipe(
  map(project => !!project),
  distinctUntilChanged(),
)

const tooltip$ = combineLatest([selectedProject$, selectedProjectProperties$]).pipe(
  map(([project, properties]) => {
    if (!project) return ''
    const metadata = Object.entries(properties)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}: ${value}`)
    return [project, ...metadata].join('\n')
  }),
  distinctUntilChanged(),
)

const projectIcon$ = selectedProjectProperties$.pipe(
  map(properties =>
    properties.icon
    || properties['icon-name']
    || properties.symbolicIcon
    || 'folder_code'
  ),
  distinctUntilChanged(),
)

const projectName$ = combineLatest([selectedProject$, selectedProjectProperties$]).pipe(
  map(([project, properties]) => project ? firstProjectName(project, properties).trim() : ''),
  distinctUntilChanged(),
)

const branch$ = selectedProjectProperties$.pipe(
  map(properties => (properties.branch || '').trim()),
  distinctUntilChanged(),
)

const subproj$ = selectedProjectProperties$.pipe(
  map(properties => (properties.subproj || '').trim()),
  distinctUntilChanged(),
)

const task$ = selectedProjectProperties$.pipe(
  map(properties => (properties.task || '').trim()),
  distinctUntilChanged(),
)

const projectSecondary$ = combineLatest([subproj$, branch$]).pipe(
  map(([subproj, branch]) => (subproj ? '' : branch)),
  distinctUntilChanged(),
)

const contextVisible$ = subproj$.pipe(map(subproj => !!subproj), distinctUntilChanged())

const contextIcon$ = selectedProjectProperties$.pipe(
  map(properties => properties['display-icon'] || 'folder_code'),
  distinctUntilChanged(),
)

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

const projectTooltip = (
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
  return [project, ...metadata, ...agentLines].join('\n')
}

const isWorking = (status: AgentStatus) =>
  status.state === 'thinking'
  || status.state === 'tool-use'
  || status.state === 'compacting'

const aggregateAgents = (agents: ProjectAgent[]): ProjectAggregate => {
  const count = agents.length
  return {
    count,
    hasAttention: agents.some(agent => agent.status.requiresAttention),
    allIdle: count > 0 && agents.every(agent => agent.status.state === 'idle'),
    hasWorking: agents.some(agent => isWorking(agent.status)),
    hasComplete: agents.some(agent => agent.status.taskComplete),
  }
}

const { sessions$ } = getAgentService()

const sessionIds$ = sessions$.pipe(
  map(sessions => [...sessions.keys()].sort()),
  distinctUntilChanged(sameArray),
  shareReplay(1),
)

const sessionProjects$ = sessionIds$.pipe(
  switchMap(sessionIds => {
    if (sessionIds.length === 0) return of(new Map<string, string>())

    return combineLatest(
      sessionIds.map(sessionId =>
        locus.agentSessionProjectString$(`agent-session:${sessionId}`).pipe(
          map(project => [sessionId, project] as const),
        )
      ),
    ).pipe(
      map(entries => new Map<string, string>(entries)),
    )
  }),
  shareReplay(1),
)

const projectAgents$ = combineLatest([sessions$, sessionProjects$]).pipe(
  map(([sessions, projects]) =>
    [...sessions.entries()]
      .map(([sessionId, status]) => ({
        sessionId,
        status,
        project: projects.get(sessionId) ?? '',
      }))
      .filter(agent => !!agent.project)
      .sort((left, right) =>
        Number(left.status.isSubagent) - Number(right.status.isSubagent)
        || left.sessionId.localeCompare(right.sessionId),
      ),
  ),
  shareReplay(1),
)

const workspaceProjects$ = (monitor: Gdk.Monitor) => workspacesOnMonitor$(monitor).pipe(
  switchMap(workspaces => {
    if (workspaces.length === 0) return of([] as WorkspaceProject[])

    return combineLatest(
      workspaces.map(workspace =>
        combineLatest([
          locus.targets$(workspace.subject, 'project'),
          locus.numberProperty$(workspace.subject, 'index', workspace.wsId),
        ]).pipe(
          map(([projects, workspaceIndex]) => ({
            project: projects[0] ?? '',
            workspaceIndex: workspaceIndex > 0 ? workspaceIndex : workspace.wsId,
          })),
        ),
      ),
    ).pipe(
      map(projects => projects
        .filter(item => !!item.project)
        .sort((left, right) => left.workspaceIndex - right.workspaceIndex)),
    )
  }),
  map(projects => {
    const ordered = new Map<string, WorkspaceProject>()
    for (const project of projects) {
      if (!ordered.has(project.project)) ordered.set(project.project, project)
    }
    return [...ordered.values()]
  }),
  distinctUntilChanged((left, right) =>
    left.length === right.length
    && left.every((value, index) =>
      value.project === right[index].project
      && value.workspaceIndex === right[index].workspaceIndex,
    ),
  ),
  shareReplay(1),
)

const projectIds$ = (monitor: Gdk.Monitor) => combineLatest([
  workspaceProjects$(monitor),
  selectedProject$,
  projectAgents$,
]).pipe(
  map(([workspaceProjects, selectedProject, agents]) => {
    const ids = new Set<string>()
    for (const item of workspaceProjects) ids.add(item.project)
    for (const agent of agents) ids.add(agent.project)
    if (selectedProject) ids.add(selectedProject)
    return [...ids]
  }),
  distinctUntilChanged(sameArray),
  shareReplay(1),
)

const projectAgentIds$ = projectAgents$.pipe(
  map(agents => {
    const ids = new Map<string, string[]>()
    for (const agent of agents) {
      const projectIds = ids.get(agent.project) ?? []
      projectIds.push(agent.sessionId)
      ids.set(agent.project, projectIds)
    }
    return ids
  }),
  shareReplay(1),
)

const agentsForProject$ = (project: string) => projectAgents$.pipe(
  map(agents => agents.filter(agent => agent.project === project)),
  shareReplay(1),
)

const ProjectWidget = (project: string, sessionIds: string[]) => {
  const agents$ = agentsForProject$(project)
  const properties$ = locus.properties$(project).pipe(shareReplay(1))
  const expanded$ = selectedProject$.pipe(
    map(selectedProject => selectedProject === project),
    distinctUntilChanged(),
    shareReplay(1),
  )
  const icon$ = properties$.pipe(
    map(projectDisplayIcon),
    distinctUntilChanged(),
    shareReplay(1),
  )
  const titleParts$ = properties$.pipe(
    map(properties => projectTitleParts(project, properties)),
    distinctUntilChanged(
      (left, right) => left[0] === right[0] && left[1] === right[1],
    ),
    shareReplay(1),
  )
  const primary$ = titleParts$.pipe(map(parts => parts[0]), distinctUntilChanged())
  const secondary$ = titleParts$.pipe(map(parts => parts[1]), distinctUntilChanged())
  const aggregate$ = agents$.pipe(
    map(aggregateAgents),
    distinctUntilChanged(sameAggregate),
    shareReplay(1),
  )
  const tooltip$ = combineLatest([properties$, agents$]).pipe(
    map(([properties, agents]) => projectTooltip(project, properties, agents)),
    distinctUntilChanged(),
  )

  const agentWidgets = sessionIds.map(sessionId => {
    const subagentCount$ = locus
      .targets$(`agent-session:${sessionId}`, 'subagent-session')
      .pipe(
        map(children => children.length),
        distinctUntilChanged(),
        shareReplay(1),
      )

    return AgentWidget(sessionId, subagentCount$)
  })

  const titleBox = (
    <box spacing={4} halign={Gtk.Align.START} cssClasses={['projects-title']}>
      <label
        label={bindAs(primary$, primary => primary, '')}
        xalign={0}
        ellipsize={3}
        maxWidthChars={18}
        cssClasses={['projects-primary']}
      />
      <label
        label="·"
        xalign={0}
        visible={bindAs(secondary$, secondary => !!secondary, false)}
        cssClasses={['projects-delimiter']}
      />
      <label
        label={bindAs(secondary$, secondary => secondary, '')}
        xalign={0}
        visible={bindAs(secondary$, secondary => !!secondary, false)}
        ellipsize={3}
        maxWidthChars={18}
        cssClasses={['projects-secondary']}
      />
    </box>
  ) as Gtk.Box

  const rootButton = (
    <button
      tooltipText={bindAs(tooltip$, tooltip => tooltip, '')}
      cssClasses={['projects-root-button']}
    >
      <box cssClasses={['projects-collapsed-icon']}>
        <MaterialIcon
          icon={bindAs(icon$, icon => icon, 'folder_code')}
          tinted={false}
        />
      </box>
    </button>
  ) as Gtk.Button

  const widget = PanelButtonGroup({
    cssClasses: ['projects-project'],
    expandDirection: 'right',
    revealWhen: expanded$,
    children: [rootButton, titleBox, ...agentWidgets],
  }) as Gtk.Box

  subscribeTo(widget, expanded$, (expanded, w) => {
    if (expanded) {
      w.add_css_class('current-workspace')
    } else {
      w.remove_css_class('current-workspace')
    }
  })

  subscribeTo(widget, aggregate$, (aggregate, w) => {
    w.remove_css_class('has-attention')
    w.remove_css_class('all-idle')
    w.remove_css_class('has-working')
    w.remove_css_class('has-complete')

    if (aggregate.hasAttention) w.add_css_class('has-attention')
    if (aggregate.allIdle) w.add_css_class('all-idle')
    if (aggregate.hasWorking) w.add_css_class('has-working')
    if (aggregate.hasComplete) w.add_css_class('has-complete')
  })

  return widget
}

export const SimpleProjectChip = (props: SimpleProjectChipProps) => {
  const cssClasses = (props.cssClasses ?? []).concat(['locus-project-chip'])

  return (
    <box
      cssClasses={cssClasses}
      spacing={4}
      visible={bindAs(props.visible$, v => v, false)}
      tooltipText={bindAs(props.tooltip$, v => v, '')}
    >
      <MaterialIcon icon={bindAs(props.icon$, v => v, 'folder_code')} tinted={false} />
      <label
        label={bindAs(props.primary$, v => v, '')}
        ellipsize={3}
        maxWidthChars={22}
        cssClasses={['locus-project-primary']}
      />
      <label
        label="·"
        visible={bindAs(props.secondary$, v => !!v, false)}
        cssClasses={['locus-project-delimiter']}
      />
      <label
        label={bindAs(props.secondary$, v => v, '')}
        visible={bindAs(props.secondary$, v => !!v, false)}
        ellipsize={3}
        maxWidthChars={18}
        cssClasses={['locus-project-secondary']}
      />
    </box>
  ) as Gtk.Box
}

export const LocusProjectChip = (props: WidgetProps) => (
  <SimpleProjectChip
    cssClasses={props.cssClasses ?? []}
    icon$={projectIcon$}
    primary$={projectName$}
    secondary$={projectSecondary$}
    visible$={visible$}
    tooltip$={tooltip$}
  />
) as Gtk.Box

export const LocusContextChip = (props: WidgetProps) => (
  <SimpleProjectChip
    cssClasses={(props.cssClasses ?? []).concat(['locus-context-chip'])}
    icon$={contextIcon$}
    primary$={subproj$}
    secondary$={task$}
    visible$={contextVisible$}
    tooltip$={tooltip$}
  />
) as Gtk.Box

export const LocusProjectWidget = (props: WidgetProps) => (
  <box
    cssClasses={(props.cssClasses ?? []).concat(['locus-project-widget'])}
    spacing={4}
    visible={bindAs(visible$, v => v, false)}
  >
    <LocusProjectChip />
    <MaterialIcon
      icon="chevron_right"
      tinted={false}
      visible={bindAs(contextVisible$, v => v, false)}
      cssClasses={['locus-project-group-delimiter']}
    />
    <LocusContextChip />
  </box>
) as Gtk.Box

export const ProjectsWidget = (props: WidgetProps & { monitor: Gdk.Monitor }) => {
  const projectIds = projectIds$(props.monitor)
  const list = (
    <box
      cssClasses={['projects-list']}
      spacing={4}
    />
  ) as Gtk.Box
  const container = (
    <box
      cssClasses={(props.cssClasses ?? []).concat(['projects-widget'])}
      visible={bindAs(projectIds, ids => ids.length > 0, false)}
    >
      {list}
    </box>
  ) as Gtk.Box
  const widgets = new Map<string, { widget: Gtk.Widget; signature: string }>()

  subscribeTo(
    list,
    combineLatest([projectIds, projectAgentIds$]),
    ([projectIds, projectAgents], box) => {
      for (const project of [...widgets.keys()]) {
        if (!projectIds.includes(project)) widgets.delete(project)
      }

      let child = box.get_first_child()
      while (child) {
        const next = child.get_next_sibling()
        box.remove(child)
        child = next
      }

      for (const project of projectIds) {
        const sessionIds = projectAgents.get(project) ?? []
        const signature = sessionIds.join('\0')
        const entry = widgets.get(project)
        if (!entry || entry.signature !== signature) {
          widgets.set(project, {
            signature,
            widget: ProjectWidget(project, sessionIds),
          })
        }
        box.append(widgets.get(project)!.widget)
      }
    },
  )

  return container
}
