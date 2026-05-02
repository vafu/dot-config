import { Gdk, Gtk } from 'ags/gtk4'
import { getAgentService, AgentStatus } from 'services/agent'
import { LevelIndicator } from 'widgets/circularstatus'
import { MaterialIcon } from 'widgets/materialicon'
import { bindAs, subscribeTo } from 'rxbinding'
import { map, distinctUntilChanged, shareReplay, switchMap } from 'rxjs'
import { WidgetProps } from 'widgets'

const CONTEXT_STAGES = [
  { level: 0, class: 'normal' },
  { level: 50, class: 'warn' },
  { level: 75, class: 'high' },
  { level: 90, class: 'danger' },
  { level: 95, class: 'critical' },
]

const STYLE = { style: 'line' as const, thickness: 3 }

const DEFAULT_STATUS: AgentStatus = { agentName: '', state: 'no-session', taskComplete: false, requiresAttention: false, contextPct: 0, modelName: '', cwd: '', costUsd: 0, pendingPrompt: '', pendingOptions: [], sessionName: '', fiveHourUsagePct: 0, fiveHourResetsAt: 0, sevenDayUsagePct: 0, sevenDayResetsAt: 0 }

const AgentWidget = (sessionId: string) => {
  const { sessions$, respondToElicitation, iconForSession } = getAgentService()

  const status$ = sessions$.pipe(
    map(sessions => sessions.get(sessionId) ?? DEFAULT_STATUS),
    distinctUntilChanged((a, b) =>
      a.state === b.state &&
      a.agentName === b.agentName &&
      a.taskComplete === b.taskComplete &&
      a.requiresAttention === b.requiresAttention &&
      a.contextPct === b.contextPct &&
      a.modelName === b.modelName &&
      a.cwd === b.cwd &&
      a.costUsd === b.costUsd &&
      a.pendingPrompt === b.pendingPrompt &&
      a.pendingOptions.join('\0') === b.pendingOptions.join('\0') &&
      a.sessionName === b.sessionName
    ),
    shareReplay(1),
  )

  const state$ = status$.pipe(map(s => s.state), distinctUntilChanged())
  const projectIcon$ = status$.pipe(
    map(s => ({ cwd: s.cwd, sessionName: s.sessionName })),
    distinctUntilChanged((a, b) => a.cwd === b.cwd && a.sessionName === b.sessionName),
    switchMap(({ cwd, sessionName }) => iconForSession(cwd, sessionName)),
    shareReplay(1),
  )
  const contextPct$ = status$.pipe(map(s => s.contextPct), distinctUntilChanged())

  const mainIcon$ = projectIcon$

  const icon = (
    <MaterialIcon
      icon={bindAs(mainIcon$, s => s, 'smart_toy')}
      tinted={false}
    />
  ) as Gtk.Widget

  const level = (
    <LevelIndicator
      stages={CONTEXT_STAGES}
      style={STYLE}
      level={bindAs(contextPct$, v => v, 0)}
      visible={bindAs(state$, s => s !== 'no-session', false)}
    />
  ) as Gtk.Widget

  // Info header
  const modelLabel = new Gtk.Label({ xalign: 0, cssClasses: ['agent-info-value'] })
  const cwdLabel = new Gtk.Label({ xalign: 0, ellipsize: 3 /* END */, maxWidthChars: 35, cssClasses: ['agent-info-value'] })
  const costLabel = new Gtk.Label({ xalign: 0, cssClasses: ['agent-info-value'] })
  const contextLabel = new Gtk.Label({ xalign: 0, cssClasses: ['agent-info-value'] })

  const infoGrid = new Gtk.Grid({ columnSpacing: 8, rowSpacing: 2, cssClasses: ['agent-info-grid'] })
  const addRow = (row: number, label: string, widget: Gtk.Widget) => {
    const l = new Gtk.Label({ label, xalign: 1, cssClasses: ['agent-info-label', 'dim-label'] })
    infoGrid.attach(l, 0, row, 1, 1)
    infoGrid.attach(widget, 1, row, 1, 1)
  }
  addRow(0, 'Model', modelLabel)
  addRow(1, 'CWD', cwdLabel)
  addRow(2, 'Cost', costLabel)
  addRow(3, 'Context', contextLabel)

  // Elicitation area
  const elicitationBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
    visible: false,
  })
  const separator = new Gtk.Separator({ cssClasses: ['agent-separator'] })
  const promptLabel = new Gtk.Label({
    wrap: true,
    maxWidthChars: 40,
    xalign: 0,
  })
  const buttonsBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  })
  elicitationBox.append(separator)
  elicitationBox.append(promptLabel)
  elicitationBox.append(buttonsBox)

  const popoverBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
    marginTop: 8,
    marginBottom: 8,
    marginStart: 8,
    marginEnd: 8,
  })
  popoverBox.append(infoGrid)
  popoverBox.append(elicitationBox)

  const popover = new Gtk.Popover({
    cssClasses: ['menu'],
    child: popoverBox,
  })

  const widget = (
    <menubutton
      cssClasses={['agent-widget', 'flat', 'circular', 'panel-widget']}
      tooltipText={bindAs(status$, s => `${s.agentName || 'agent'} · ${s.modelName || 'idle'} · ${Math.round(s.contextPct)}%`, '')}
      popover={popover}
    >
      <box cssClasses={['agent-inner']}>
        {icon}
        {level}
      </box>
    </menubutton>
  ) as Gtk.MenuButton

  subscribeTo(widget, status$, (status, w) => {
    w.remove_css_class('thinking')
    w.remove_css_class('tool-use')
    w.remove_css_class('attention')
    w.remove_css_class('no-session')
    w.remove_css_class('idle')
    w.remove_css_class('compacting')
    w.remove_css_class('task-complete')
    w.add_css_class(status.state)
    if (status.requiresAttention) w.add_css_class('attention')
    if (status.taskComplete) w.add_css_class('task-complete')

    modelLabel.label = status.modelName || '—'
    cwdLabel.label = status.cwd ? status.cwd.replace(/^\/home\/[^/]+/, '~') : '—'
    costLabel.label = status.costUsd > 0 ? `$${status.costUsd.toFixed(4)}` : '—'
    contextLabel.label = `${Math.round(status.contextPct)}%`
  })

  subscribeTo(widget, status$, status => {
    let child = buttonsBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      buttonsBox.remove(child)
      child = next
    }

    if (status.requiresAttention && status.pendingPrompt) {
      promptLabel.label = status.pendingPrompt
      elicitationBox.visible = true

      const options = status.pendingOptions.length > 0 ? status.pendingOptions : ['Allow', 'Deny']
      for (const option of options) {
        const btn = (
          <button
            label={option}
            onClicked={() => {
              console.log(`[Agent] popup button clicked: session=${sessionId} option=${option}`)
              popover.popdown()
              respondToElicitation(sessionId, option)
            }}
          />
        ) as Gtk.Button
        buttonsBox.append(btn)
      }

    } else {
      elicitationBox.visible = false
    }
  })

  return widget
}

// -- Usage fill: background gradient as progress bar --

function usageColor(pct: number): string {
  if (pct >= 90) return 'rgba(230,64,51,0.18)'    // red
  if (pct >= 75) return 'rgba(230,153,25,0.18)'   // orange
  if (pct >= 50) return 'rgba(217,204,38,0.15)'   // yellow
  return 'rgba(102,191,102,0.15)'                  // green
}

const usageFillProvider = new Gtk.CssProvider()
Gtk.StyleContext.add_provider_for_display(
  Gdk.Display.get_default()!,
  usageFillProvider,
  Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
)

function updateUsageFill(pct: number) {
  if (pct <= 0) {
    usageFillProvider.load_from_string('.agent-usage-fill { background-image: none; }')
    return
  }
  const color = usageColor(pct)
  usageFillProvider.load_from_string(
    `.agent-usage-fill { background-image: linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%); }`
  )
}

// -- AgentWidgets with usage fill background --

export const AgentWidgets = (props: WidgetProps) => {
  const { sessions$ } = getAgentService()
  const cssClasses = (props.cssClasses ?? []).concat(['agent-usage-fill'])

  const visible$ = sessions$.pipe(
    map(s => s.size > 0),
    distinctUntilChanged(),
  )

  const anyAttention$ = sessions$.pipe(
    map(s => [...s.values()].some(v => v.requiresAttention)),
    distinctUntilChanged(),
  )

  const fiveHourPct$ = sessions$.pipe(
    map(sessions => {
      let best = 0, bestReset = 0
      for (const s of sessions.values()) {
        if (s.fiveHourResetsAt > bestReset) {
          best = s.fiveHourUsagePct
          bestReset = s.fiveHourResetsAt
        }
      }
      return best
    }),
    distinctUntilChanged(),
  )

  const container = (<box cssClasses={cssClasses} visible={bindAs(visible$, v => v, false)} />) as Gtk.Box
  const sessionWidgets = new Map<string, Gtk.Widget>()

  subscribeTo(container, anyAttention$, (attention, box) => {
    if (attention) box.add_css_class('agent-attention')
    else box.remove_css_class('agent-attention')
  })

  subscribeTo(container, sessions$, (sessions, box) => {
    for (const [sessionId] of sessions) {
      if (!sessionWidgets.has(sessionId)) {
        const w = AgentWidget(sessionId)
        sessionWidgets.set(sessionId, w)
        box.append(w)
      }
    }
    for (const [sessionId, w] of [...sessionWidgets]) {
      if (!sessions.has(sessionId)) {
        box.remove(w)
        sessionWidgets.delete(sessionId)
      }
    }
  })

  subscribeTo(container, fiveHourPct$, (pct, box) => {
    updateUsageFill(pct)
    box.tooltipText = pct > 0 ? `5h usage: ${Math.round(pct)}%` : ''
  })

  return container
}
