import { Gtk } from 'ags/gtk4'
import { getAgentService } from 'services/agent'
import { getAgentStatsService, todayString } from 'services/agent-stats'
import { LevelIndicator } from 'widgets/circularstatus'
import { MaterialIcon } from 'widgets/materialicon'
import { bindAs, subscribeTo } from 'rxbinding'
import { map, distinctUntilChanged, shareReplay, combineLatest } from 'rxjs'
import { WidgetProps } from 'widgets'

const USAGE_STAGES = [
  { level: 0, class: 'normal' },
  { level: 50, class: 'warn' },
  { level: 75, class: 'high' },
  { level: 90, class: 'danger' },
]

const STYLE = { style: 'line' as const, thickness: 3 }

function formatResetTime(unixSec: number): string {
  if (!unixSec) return '—'
  const diff = unixSec * 1000 - Date.now()
  if (diff <= 0) return 'soon'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatTokens(n: number): string {
  if (!n) return '—'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

export const UsageWidget = (props: WidgetProps) => {
  const { sessions$ } = getAgentService()
  const { stats$ } = getAgentStatsService()

  // Account-wide rate limit from whichever session has the freshest data
  const rateLimit$ = sessions$.pipe(
    map(sessions => {
      let best = { fiveHourUsagePct: 0, fiveHourResetsAt: 0, sevenDayUsagePct: 0, sevenDayResetsAt: 0 }
      for (const s of sessions.values()) {
        if (s.fiveHourResetsAt > best.fiveHourResetsAt) {
          best = { fiveHourUsagePct: s.fiveHourUsagePct, fiveHourResetsAt: s.fiveHourResetsAt, sevenDayUsagePct: s.sevenDayUsagePct, sevenDayResetsAt: s.sevenDayResetsAt }
        }
      }
      return best
    }),
    distinctUntilChanged((a, b) =>
      a.fiveHourUsagePct === b.fiveHourUsagePct &&
      a.fiveHourResetsAt === b.fiveHourResetsAt &&
      a.sevenDayUsagePct === b.sevenDayUsagePct &&
      a.sevenDayResetsAt === b.sevenDayResetsAt
    ),
    shareReplay(1),
  )

  // Today's stats from the file watcher
  const today$ = stats$.pipe(
    map(stats => {
      const today = todayString()
      const activity = stats.dailyActivity.findLast(d => d.date === today)
      const tokens = stats.dailyTokens.findLast(d => d.date === today)
      return {
        tokens: tokens?.tokens ?? 0,
        messages: activity?.messages ?? 0,
        sessions: activity?.sessions ?? 0,
        toolCalls: activity?.toolCalls ?? 0,
      }
    }),
    distinctUntilChanged((a, b) =>
      a.tokens === b.tokens && a.messages === b.messages &&
      a.sessions === b.sessions && a.toolCalls === b.toolCalls
    ),
    shareReplay(1),
  )

  const hasData$ = rateLimit$.pipe(map(u => u.fiveHourResetsAt > 0), distinctUntilChanged())
  const fiveHourPct$ = rateLimit$.pipe(map(u => u.fiveHourUsagePct), distinctUntilChanged())

  // Panel fraction: tokens / messages
  const numeratorLabel   = new Gtk.Label({ cssClasses: ['numerator'],   xalign: 0.5 })
  const denominatorLabel = new Gtk.Label({ cssClasses: ['denominator'], xalign: 0.5 })
  const fractionBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, cssClasses: ['usage-fraction'], valign: Gtk.Align.CENTER })
  fractionBox.append(numeratorLabel)
  fractionBox.append(denominatorLabel)

  // Popover grid
  const fiveHourDetailLabel  = new Gtk.Label({ xalign: 0, cssClasses: ['agent-info-value'] })
  const fiveHourResetLabel   = new Gtk.Label({ xalign: 0, cssClasses: ['agent-info-value'] })
  const sevenDayDetailLabel  = new Gtk.Label({ xalign: 0, cssClasses: ['agent-info-value'] })
  const sevenDayResetLabel   = new Gtk.Label({ xalign: 0, cssClasses: ['agent-info-value'] })
  const todayTokensDetail    = new Gtk.Label({ xalign: 0, cssClasses: ['agent-info-value'] })
  const todayMessagesLabel   = new Gtk.Label({ xalign: 0, cssClasses: ['agent-info-value'] })
  const todayToolCallsLabel  = new Gtk.Label({ xalign: 0, cssClasses: ['agent-info-value'] })
  const todaySessionsLabel   = new Gtk.Label({ xalign: 0, cssClasses: ['agent-info-value'] })

  const grid = new Gtk.Grid({ columnSpacing: 8, rowSpacing: 2, cssClasses: ['agent-info-grid'] })
  const addRow = (row: number, label: string, widget: Gtk.Widget) => {
    const l = new Gtk.Label({ label, xalign: 1, cssClasses: ['agent-info-label', 'dim-label'] })
    grid.attach(l, 0, row, 1, 1)
    grid.attach(widget, 1, row, 1, 1)
  }
  addRow(0, '5h usage',   fiveHourDetailLabel)
  addRow(1, '5h resets',  fiveHourResetLabel)
  addRow(2, '7d usage',   sevenDayDetailLabel)
  addRow(3, '7d resets',  sevenDayResetLabel)
  grid.attach(new Gtk.Separator({ marginTop: 4, marginBottom: 4 }), 0, 4, 2, 1)
  addRow(5, 'tokens',     todayTokensDetail)
  addRow(6, 'messages',   todayMessagesLabel)
  addRow(7, 'tool calls', todayToolCallsLabel)
  addRow(8, 'sessions',   todaySessionsLabel)

  const popoverBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    marginTop: 8, marginBottom: 8, marginStart: 8, marginEnd: 8,
  })
  popoverBox.append(grid)

  const popover = new Gtk.Popover({ cssClasses: ['menu'], child: popoverBox })

  const fiveHourLevel = (
    <LevelIndicator stages={USAGE_STAGES} style={STYLE} level={bindAs(fiveHourPct$, v => v, 0)} />
  ) as Gtk.Widget

  const widget = (
    <menubutton
      cssClasses={['agent-widget', 'flat', 'panel-widget']}
      visible={bindAs(hasData$, v => v, false)}
      tooltipText={bindAs(rateLimit$, u => `5h: ${Math.round(u.fiveHourUsagePct)}% · 7d: ${Math.round(u.sevenDayUsagePct)}%`, '')}
      popover={popover}
    >
      <box cssClasses={['agent-inner']} spacing={4}>
        <MaterialIcon icon="speed" tinted={false} />
        {fiveHourLevel}
        {fractionBox}
      </box>
    </menubutton>
  ) as Gtk.MenuButton

  subscribeTo(widget, rateLimit$, u => {
    fiveHourDetailLabel.label  = `${Math.round(u.fiveHourUsagePct)}%`
    fiveHourResetLabel.label   = formatResetTime(u.fiveHourResetsAt)
    sevenDayDetailLabel.label  = `${Math.round(u.sevenDayUsagePct)}%`
    sevenDayResetLabel.label   = formatResetTime(u.sevenDayResetsAt)
  })

  subscribeTo(widget, today$, t => {
    numeratorLabel.label      = formatTokens(t.tokens)
    denominatorLabel.label    = t.messages ? `${t.messages}` : '—'
    todayTokensDetail.label   = formatTokens(t.tokens)
    todayMessagesLabel.label  = `${t.messages}`
    todayToolCallsLabel.label = `${t.toolCalls}`
    todaySessionsLabel.label  = `${t.sessions}`
  })

  subscribeTo(widget, fiveHourPct$, (pct, w) => {
    w.remove_css_class('normal')
    w.remove_css_class('warn')
    w.remove_css_class('high')
    w.remove_css_class('danger')
    if (pct >= 90) w.add_css_class('danger')
    else if (pct >= 75) w.add_css_class('high')
    else if (pct >= 50) w.add_css_class('warn')
    else w.add_css_class('normal')
  })

  const container = (
    <box cssClasses={props.cssClasses ?? []} visible={bindAs(hasData$, v => v, false)}>
      {widget}
    </box>
  ) as Gtk.Box
  return container
}
