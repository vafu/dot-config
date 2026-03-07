import { Gtk } from 'ags/gtk4'
import { getClaudeService, ClaudeState, ClaudeStatus } from 'services/claude'
import { LevelIndicator } from 'widgets/circularstatus'
import { MaterialIcon } from 'widgets/materialicon'
import { bindAs, subscribeTo } from 'rxbinding'
import { map, distinctUntilChanged, shareReplay } from 'rxjs'
import { WidgetProps } from 'widgets'

const ICON: Record<ClaudeState, string> = {
  'no-session': 'smart_toy',
  'idle': 'smart_toy',
  'thinking': 'psychology',
  'attention': 'notification_important',
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

const DEFAULT_STATUS: ClaudeStatus = { state: 'no-session', contextPct: 0, modelName: '' }

const ClaudeWidget = (sessionId: string, cssClasses: string[]) => {
  const { sessions$, elicitation$, respondToElicitation } = getClaudeService()

  const status$ = sessions$.pipe(
    map(sessions => sessions.get(sessionId) ?? DEFAULT_STATUS),
    distinctUntilChanged((a, b) => a.state === b.state && a.contextPct === b.contextPct && a.modelName === b.modelName),
    shareReplay(1),
  )

  const sessionElicitation$ = elicitation$.pipe(
    map(e => e?.sessionId === sessionId ? e : null),
    distinctUntilChanged(),
  )

  const state$ = status$.pipe(map(s => s.state), distinctUntilChanged())
  const icon$ = state$.pipe(map(s => ICON[s]))
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

  const promptLabel = new Gtk.Label({
    wrap: true,
    maxWidthChars: 40,
    xalign: 0,
  })

  const buttonsBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  })

  const popoverBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
    marginTop: 8,
    marginBottom: 8,
    marginStart: 8,
    marginEnd: 8,
  })
  popoverBox.append(promptLabel)
  popoverBox.append(buttonsBox)

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

  subscribeTo(widget, state$, (state, w) => {
    w.remove_css_class('thinking')
    w.remove_css_class('attention')
    w.remove_css_class('no-session')
    w.remove_css_class('idle')
    w.remove_css_class('compacting')
    w.add_css_class(state)
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

      for (const option of elicitation.options) {
        const btn = (
          <button
            label={option}
            onClicked={() => {
              console.log(`[Claude] popup button clicked: session=${sessionId} option=${option}`)
              respondToElicitation(sessionId, option)
              w.active = false
            }}
          />
        ) as Gtk.Button
        buttonsBox.append(btn)
      }

    } else {
      w.active = false
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
