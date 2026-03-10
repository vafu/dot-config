import { Gtk } from 'ags/gtk4'
import { getClaudeService, ClaudeState, ClaudeStatus } from 'services/claude'
import { LevelIndicator } from 'widgets/circularstatus'
import { MaterialIcon } from 'widgets/materialicon'
import { bindAs, subscribeTo } from 'rxbinding'
import { map, distinctUntilChanged, shareReplay } from 'rxjs'
import { WidgetProps } from 'widgets'

const STATE_ICON: Record<ClaudeState, string> = {
  'no-session': 'smart_toy',
  'idle': 'smart_toy',
  'thinking': 'psychology',
  'tool-use': 'build',
  'compacting': 'compress',
}

const CONTEXT_STAGES = [
  { level: 0, class: 'normal' },
  { level: 50, class: 'warn' },
  { level: 75, class: 'high' },
  { level: 90, class: 'danger' },
  { level: 95, class: 'critical' },
]

const STYLE = { style: 'line' as const, thickness: 3 }

const DEFAULT_STATUS: ClaudeStatus = { state: 'no-session', taskComplete: false, requiresAttention: false, contextPct: 0, modelName: '', cwd: '', costUsd: 0 }

const ClaudeWidget = (sessionId: string, cssClasses: string[]) => {
  const { sessions$, elicitation$, respondToElicitation } = getClaudeService()

  const status$ = sessions$.pipe(
    map(sessions => sessions.get(sessionId) ?? DEFAULT_STATUS),
    distinctUntilChanged((a, b) =>
      a.state === b.state &&
      a.taskComplete === b.taskComplete &&
      a.requiresAttention === b.requiresAttention &&
      a.contextPct === b.contextPct &&
      a.modelName === b.modelName &&
      a.cwd === b.cwd &&
      a.costUsd === b.costUsd
    ),
    shareReplay(1),
  )

  const sessionElicitation$ = elicitation$.pipe(
    map(e => e?.sessionId === sessionId ? e : null),
    distinctUntilChanged(),
  )

  const state$ = status$.pipe(map(s => s.state), distinctUntilChanged())
  const icon$ = status$.pipe(
    map(s => s.taskComplete ? 'task_alt' : STATE_ICON[s.state]),
    distinctUntilChanged(),
  )
  const contextPct$ = status$.pipe(map(s => s.contextPct), distinctUntilChanged())

  const icon = (
    <MaterialIcon
      icon={bindAs(icon$, s => s, 'smart_toy')}
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
  const modelLabel = new Gtk.Label({ xalign: 0, cssClasses: ['claude-info-value'] })
  const cwdLabel = new Gtk.Label({ xalign: 0, ellipsize: 3 /* END */, maxWidthChars: 35, cssClasses: ['claude-info-value'] })
  const costLabel = new Gtk.Label({ xalign: 0, cssClasses: ['claude-info-value'] })
  const contextLabel = new Gtk.Label({ xalign: 0, cssClasses: ['claude-info-value'] })

  const infoGrid = new Gtk.Grid({ columnSpacing: 8, rowSpacing: 2, cssClasses: ['claude-info-grid'] })
  const addRow = (row: number, label: string, widget: Gtk.Widget) => {
    const l = new Gtk.Label({ label, xalign: 1, cssClasses: ['claude-info-label', 'dim-label'] })
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
  const separator = new Gtk.Separator({ cssClasses: ['claude-separator'] })
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
      cssClasses={cssClasses.concat(['claude-widget', 'flat', 'circular', 'panel-widget'])}
      tooltipText={bindAs(status$, s => `Claude · ${s.modelName || 'idle'} · ${Math.round(s.contextPct)}%`, '')}
      popover={popover}
    >
      <box>
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

  subscribeTo(widget, sessionElicitation$, (elicitation, w) => {
    let child = buttonsBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      buttonsBox.remove(child)
      child = next
    }

    if (elicitation) {
      promptLabel.label = elicitation.prompt
      elicitationBox.visible = true

      for (const option of elicitation.options) {
        const btn = (
          <button
            label={option}
            onClicked={() => {
              console.log(`[Claude] popup button clicked: session=${sessionId} option=${option}`)
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

export const ClaudeWidgets = (props: WidgetProps) => {
  const { sessions$ } = getClaudeService()
  const cssClasses = props.cssClasses ?? []

  const container = (<box />) as Gtk.Box
  const widgets = new Map<string, Gtk.Widget>()

  subscribeTo(container, sessions$, (sessions, box) => {
    // Add widgets for new sessions
    for (const [sessionId] of sessions) {
      if (!widgets.has(sessionId)) {
        const w = ClaudeWidget(sessionId, cssClasses)
        widgets.set(sessionId, w)
        box.append(w)
      }
    }
    // Remove widgets for ended sessions
    for (const [sessionId, w] of [...widgets]) {
      if (!sessions.has(sessionId)) {
        box.remove(w)
        widgets.delete(sessionId)
      }
    }
  })

  return container
}
