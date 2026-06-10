import { Gtk } from 'ags/gtk4'
import { getAgentService, AgentStatus } from 'services/agent'
import { locus } from 'services/locus.generated'
import { LevelIndicator } from 'widgets/circularstatus'
import { MaterialIcon } from 'widgets/materialicon'
import { bindAs, subscribeTo } from 'rxbinding'
import { Observable, combineLatest, map, distinctUntilChanged, shareReplay } from 'rxjs'

const CONTEXT_STAGES = [
  { level: 0, class: 'normal' },
  { level: 50, class: 'warn' },
  { level: 75, class: 'high' },
  { level: 90, class: 'danger' },
  { level: 95, class: 'critical' },
]

const STYLE = { style: 'line' as const, thickness: 3 }

const DEFAULT_STATUS: AgentStatus = { agentName: '', isSubagent: false, parentSessionId: '', agentNickname: '', agentRole: '', state: 'no-session', taskComplete: false, requiresAttention: false, attentionReasons: [], contextPct: 0, modelName: '', cwd: '', costUsd: 0, pendingPrompt: '', pendingDetailKind: '', pendingDetailText: '', pendingOptions: [], pendingOptionDescriptions: [], pendingCount: 0, pendingRequestIds: [], pendingPrompts: [], pendingDetailKinds: [], pendingDetailTexts: [], pendingOptionsList: [], pendingOptionDescriptionsList: [], sessionName: '', fiveHourUsagePct: 0, fiveHourResetsAt: 0, sevenDayUsagePct: 0, sevenDayResetsAt: 0 }

const ATTENTION_REASON_CLASSES = [
  'pending-request',
  'request-user-input',
  'plan-mode-prompt',
  'agent-turn-complete',
  'tool-suggestion',
  'exec-approval',
  'apply-patch-approval',
  'request-permissions',
  'mcp-server-elicitation',
  'attention',
]

type PendingRequest = {
  requestId: string
  prompt: string
  options: string[]
  optionDescriptions: string[]
}

function pendingRequests(status: AgentStatus): PendingRequest[] {
  if (!status.requiresAttention) return []

  if (status.pendingRequestIds.length > 0) {
    return status.pendingRequestIds.map((requestId, idx) => ({
      requestId,
      prompt: status.pendingPrompts[idx] ?? status.pendingPrompt,
      options: status.pendingOptionsList[idx] ?? status.pendingOptions,
      optionDescriptions: status.pendingOptionDescriptionsList[idx] ?? status.pendingOptionDescriptions,
    })).filter(request => request.prompt)
  }

  if (!status.pendingPrompt) return []
  return [{ requestId: '', prompt: status.pendingPrompt, options: status.pendingOptions, optionDescriptions: status.pendingOptionDescriptions }]
}

function pendingSignature(status: AgentStatus): string {
  return pendingRequests(status)
    .map(request => `${request.requestId}:${request.prompt}:${request.options.join('\0')}:${request.optionDescriptions.join('\0')}`)
    .join('\n')
}

function hasPromptAttention(status: AgentStatus): boolean {
  return pendingRequests(status).length > 0
}

function attentionSignature(status: AgentStatus): string {
  return status.attentionReasons.join('\0')
}

function attentionLabel(status: AgentStatus): string {
  if (!status.requiresAttention) return ''
  const labels = status.attentionReasons.length > 0 ? status.attentionReasons : ['attention']
  return ` · ${labels.join(', ')}`
}

type AgentWidgetOptions = {
  highlightSelected?: boolean
}

export const AgentWidget = (
  sessionId: string,
  subagentCount$: Observable<number>,
  options: AgentWidgetOptions = {},
) => {
  const { sessions$, respondToElicitation } = getAgentService()
  const highlightSelected = options.highlightSelected ?? true
  const agentSessionNode = `agent-session:${sessionId}`

  const status$ = sessions$.pipe(
    map(sessions => sessions.get(sessionId) ?? DEFAULT_STATUS),
    distinctUntilChanged((a, b) =>
      a.state === b.state &&
      a.agentName === b.agentName &&
      a.isSubagent === b.isSubagent &&
      a.parentSessionId === b.parentSessionId &&
      a.agentNickname === b.agentNickname &&
      a.agentRole === b.agentRole &&
      a.taskComplete === b.taskComplete &&
      a.requiresAttention === b.requiresAttention &&
      attentionSignature(a) === attentionSignature(b) &&
      a.contextPct === b.contextPct &&
      a.modelName === b.modelName &&
      a.cwd === b.cwd &&
      a.costUsd === b.costUsd &&
      pendingSignature(a) === pendingSignature(b) &&
      a.sessionName === b.sessionName
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  )

  const state$ = status$.pipe(map(s => s.state), distinctUntilChanged())
  const projectIcon$ = locus.agentSessionWorkspaceProjectProperty$(agentSessionNode, 'display-icon').pipe(
    map(icon => icon || 'smart_toy'),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
  const projectBranch$ = combineLatest([
    locus.agentSessionWorkspaceProjectProperty$(agentSessionNode, 'branch'),
    locus.agentSessionProjectProperty$(agentSessionNode, 'branch'),
  ]).pipe(
    map(([workspaceBranch, directBranch]) => workspaceBranch || directBranch),
    map(branch => branch.trim()),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
  const contextPct$ = status$.pipe(map(s => s.contextPct), distinctUntilChanged())
  const selected$ = locus.selectedAgentSessionString$().pipe(
    map(selected => selected === agentSessionNode),
    distinctUntilChanged(),
  )
  const tooltip$ = combineLatest([status$, projectBranch$]).pipe(
    map(([status, branch]) => {
      const branchPart = branch ? ` · ${branch}` : ''
      return `${status.agentName || 'agent'} · ${status.modelName || 'idle'}${branchPart} · ${Math.round(status.contextPct)}%${attentionLabel(status)}`
    }),
    distinctUntilChanged(),
  )

  const subagentBadgeVisible$ = subagentCount$.pipe(
    map(count => count > 0),
    distinctUntilChanged(),
  )

  const icon = (
    <MaterialIcon
      icon={bindAs(projectIcon$, s => s, 'smart_toy')}
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
  const branchLabel = new Gtk.Label({ xalign: 0, ellipsize: 3 /* END */, maxWidthChars: 35, cssClasses: ['agent-info-value'] })
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
  addRow(1, 'Branch', branchLabel)
  addRow(2, 'CWD', cwdLabel)
  addRow(3, 'Cost', costLabel)
  addRow(4, 'Context', contextLabel)

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
      tooltipText={bindAs(tooltip$, s => s, '')}
      popover={popover}
    >
      <overlay>
        <box cssClasses={['agent-inner']}>
          {icon}
          {level}
        </box>
        <label
          $type="overlay"
          label={bindAs(subagentCount$, count => count > 9 ? '9+' : `${count}`, '')}
          visible={bindAs(subagentBadgeVisible$, visible => visible, false)}
          cssClasses={['agent-subagent-badge']}
          halign={Gtk.Align.END}
          valign={Gtk.Align.START}
        />
      </overlay>
    </menubutton>
  ) as Gtk.MenuButton

  subscribeTo(widget, status$, (status, w) => {
    w.remove_css_class('thinking')
    w.remove_css_class('tool-use')
    w.remove_css_class('attention')
    w.remove_css_class('attention-passive')
    w.remove_css_class('no-session')
    w.remove_css_class('idle')
    w.remove_css_class('compacting')
    w.remove_css_class('task-complete')
    for (const reason of ATTENTION_REASON_CLASSES) {
      w.remove_css_class(`attention-${reason}`)
    }
    w.add_css_class(status.state)
    if (status.requiresAttention) {
      w.add_css_class(hasPromptAttention(status) ? 'attention' : 'attention-passive')
      const reasons = status.attentionReasons.length > 0 ? status.attentionReasons : ['attention']
      for (const reason of reasons) {
        w.add_css_class(`attention-${reason}`)
      }
    }
    if (status.taskComplete) w.add_css_class('task-complete')

    modelLabel.label = status.modelName || '—'
    cwdLabel.label = status.cwd ? status.cwd.replace(/^\/home\/[^/]+/, '~') : '—'
    costLabel.label = status.costUsd > 0 ? `$${status.costUsd.toFixed(4)}` : '—'
    contextLabel.label = `${Math.round(status.contextPct)}%`
  })

  subscribeTo(widget, projectBranch$, branch => {
    branchLabel.label = branch || '—'
  })

  subscribeTo(widget, selected$, (selected, w) => {
    if (!highlightSelected) {
      w.remove_css_class('selected')
      return
    }

    if (selected) w.add_css_class('selected')
    else w.remove_css_class('selected')
  })

  subscribeTo(widget, status$, status => {
    let child = buttonsBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      buttonsBox.remove(child)
      child = next
    }

    const requests = pendingRequests(status)
    if (requests.length > 0) {
      promptLabel.label = requests.length === 1 ? requests[0].prompt : `${requests.length} pending requests`
      elicitationBox.visible = true

      for (const request of requests) {
        if (requests.length > 1) {
          buttonsBox.append(new Gtk.Label({
            label: request.prompt,
            wrap: true,
            maxWidthChars: 40,
            xalign: 0,
            cssClasses: ['agent-popup-prompt'],
          }))
        }

        const options = request.options.length > 0 ? request.options : ['Allow', 'Deny']
        const optionDescriptions = request.optionDescriptions.length > 0
          ? request.optionDescriptions
          : options.map(() => '')
        for (const [idx, option] of options.entries()) {
          const description = optionDescriptions[idx] ?? ''
          const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
          content.append(new Gtk.Label({ label: option, xalign: 0 }))
          if (description) {
            content.append(new Gtk.Label({
              label: description,
              wrap: true,
              maxWidthChars: 40,
              xalign: 0,
              cssClasses: ['agent-popup-option-detail'],
            }))
          }
          const btn = (
            <button
              onClicked={() => {
                console.log(`[Agent] popup button clicked: session=${sessionId} request=${request.requestId || '(oldest)'} option=${option}`)
                popover.popdown()
                respondToElicitation(sessionId, option, request.requestId)
              }}
            >
              {content}
            </button>
          ) as Gtk.Button
          buttonsBox.append(btn)
        }
      }

    } else {
      elicitationBox.visible = false
    }
  })

  return widget
}
