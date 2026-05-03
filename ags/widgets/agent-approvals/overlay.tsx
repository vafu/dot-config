import App from 'ags/gtk4/app'
import { Accessor } from 'gnim'
import { Astal, Gdk, Gtk } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'
import { bindAs, binding } from 'rxbinding'
import { getAgentService, AgentStatus } from 'services/agent'
import approvalsUi from 'widgets/agent-approvals'
import { MaterialIcon } from 'widgets/materialicon'
import { map, distinctUntilChanged } from 'rxjs'

type PendingApproval = {
  sessionId: string
  status: AgentStatus
}

const prettyPath = (path: string) => path ? path.replace(/^\/home\/[^/]+/, '~') : 'unknown cwd'

function pendingApprovals(): PendingApproval[] {
  return [...getAgentService().sessions$.value.entries()]
    .filter(([, status]) => status.requiresAttention && status.pendingPrompt)
    .map(([sessionId, status]) => ({ sessionId, status }))
}

function makeOptionButton(
  label: string,
  idx: number,
  selected: () => number,
  select: (idx: number) => void,
  answer: () => void,
) {
  const button = new Gtk.Button({
    cssClasses: ['agent-approval-option'],
    hexpand: true,
  })
  const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 })
  row.append(new Gtk.Label({ label: `${idx + 1}`, cssClasses: ['agent-approval-key'] }))
  row.append(new Gtk.Label({ label, xalign: 0, hexpand: true, wrap: true }))
  button.set_child(row)
  button.connect('clicked', () => {
    select(idx)
    answer()
  })
  button.connect('notify::has-focus', () => {
    if (button.has_focus()) select(idx)
  })
  if (idx === selected()) button.add_css_class('selected')
  return button
}

export function AgentApprovalOverlay(monitor: Accessor<Gdk.Monitor>) {
  const { sessions$, respondToElicitation, iconForSession } = getAgentService()
  const carousel = new Adw.Carousel({
    orientation: Gtk.Orientation.HORIZONTAL,
    allowMouseDrag: true,
    allowScrollWheel: true,
    allowLongSwipes: true,
    interactive: true,
    spacing: 24,
    hexpand: true,
    vexpand: true,
  })
  const dots = new Adw.CarouselIndicatorDots({ carousel })
  const cards: Gtk.Widget[] = []
  const optionButtons: Gtk.Widget[] = []
  let requests: PendingApproval[] = []
  let selectedOption = 0

  const refreshSelection = () => {
    optionButtons.forEach((button, idx) => {
      if (idx === selectedOption) button.add_css_class('selected')
      else button.remove_css_class('selected')
    })
  }

  const choose = (request: PendingApproval, answer: string) => {
    respondToElicitation(request.sessionId, answer)
    requests = requests.filter(r => r.sessionId !== request.sessionId)
    if (requests.length === 0) {
      approvalsUi.hide()
    } else {
      rebuild()
    }
  }

  const selectedRequest = () => {
    const pos = Math.max(0, Math.round(carousel.get_position()))
    return requests[Math.min(pos, requests.length - 1)]
  }

  const currentOptions = () => selectedRequest()?.status.pendingOptions ?? []

  const answerSelected = () => {
    const request = selectedRequest()
    if (!request) return
    const options = request.status.pendingOptions.length > 0 ? request.status.pendingOptions : ['Allow', 'Deny']
    choose(request, options[Math.min(selectedOption, options.length - 1)])
  }

  function rebuild() {
    for (const card of cards.splice(0)) carousel.remove(card)
    optionButtons.splice(0)
    selectedOption = 0
    requests = pendingApprovals()

    if (requests.length === 0) {
      const card = (
        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={16}
          vexpand={false}
          valign={Gtk.Align.CENTER}
          cssClasses={['agent-approval-card', 'agent-approval-empty-card']}
        >
          <label label="No pending approvals" cssClasses={['agent-approval-empty']} />
        </box>
      ) as Gtk.Widget
      cards.push(card)
      carousel.append(card)
      return
    }

    for (const request of requests) {
      const status = request.status
      const options = status.pendingOptions.length > 0 ? status.pendingOptions : ['Allow', 'Deny']
      const projectIcon$ = iconForSession(status.cwd, status.sessionName)
      const optionBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 8,
        cssClasses: ['agent-approval-options'],
      })

      options.forEach((option, idx) => {
        const button = makeOptionButton(
          option,
          idx,
          () => selectedOption,
          i => {
            selectedOption = i
            refreshSelection()
          },
          () => choose(request, option),
        )
        optionButtons.push(button)
        optionBox.append(button)
      })

      const card = (
        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={16}
          vexpand={false}
          valign={Gtk.Align.CENTER}
          cssClasses={['agent-approval-card']}
        >
          <box orientation={Gtk.Orientation.HORIZONTAL} spacing={12} cssClasses={['agent-approval-header']}>
            <MaterialIcon icon={bindAs(projectIcon$, s => s, 'smart_toy')} tinted={false} />
            <box orientation={Gtk.Orientation.VERTICAL} hexpand>
              <label label={prettyPath(status.cwd)} xalign={0} ellipsize={3} maxWidthChars={44} cssClasses={['agent-approval-project']} />
              <label label={status.agentName || 'agent'} xalign={0} cssClasses={['agent-approval-agent']} />
            </box>
            <label label={status.modelName || ''} cssClasses={['agent-approval-model']} />
          </box>
          <label label={status.pendingPrompt} xalign={0} wrap maxWidthChars={58} cssClasses={['agent-approval-prompt']} />
          {optionBox}
        </box>
      ) as Gtk.Widget

      cards.push(card)
      carousel.append(card)
    }
  }

  const body = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 14,
    focusable: true,
    hexpand: true,
    vexpand: true,
    cssClasses: ['agent-approval-body'],
  })
  body.append(carousel)
  body.append(dots)

  const keyController = new Gtk.EventControllerKey()
  keyController.connect('key-pressed', (_self, keyval) => {
    const options = currentOptions()
    if (keyval === Gdk.KEY_Escape) {
      approvalsUi.hide()
      return true
    }
    if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter || keyval === Gdk.KEY_space) {
      answerSelected()
      return true
    }
    if (keyval === Gdk.KEY_Left || keyval === Gdk.KEY_h) {
      carousel.scroll_to(cards[Math.max(0, Math.round(carousel.get_position()) - 1)], true)
      selectedOption = 0
      return true
    }
    if (keyval === Gdk.KEY_Right || keyval === Gdk.KEY_l) {
      carousel.scroll_to(cards[Math.min(cards.length - 1, Math.round(carousel.get_position()) + 1)], true)
      selectedOption = 0
      return true
    }
    if (keyval === Gdk.KEY_Up || keyval === Gdk.KEY_k) {
      selectedOption = Math.max(0, selectedOption - 1)
      refreshSelection()
      return true
    }
    if (keyval === Gdk.KEY_Down || keyval === Gdk.KEY_j) {
      selectedOption = Math.min(Math.max(0, options.length - 1), selectedOption + 1)
      refreshSelection()
      return true
    }
    if (keyval >= Gdk.KEY_1 && keyval <= Gdk.KEY_9) {
      const idx = keyval - Gdk.KEY_1
      const request = selectedRequest()
      if (request) {
        const requestOptions = request.status.pendingOptions.length > 0 ? request.status.pendingOptions : ['Allow', 'Deny']
        if (idx < requestOptions.length) choose(request, requestOptions[idx])
      }
      return true
    }
    return false
  })
  body.add_controller(keyController)

  sessions$
    .pipe(
      map(s => [...s.entries()]
        .filter(([, status]) => status.requiresAttention && status.pendingPrompt)
        .map(([id, status]) => `${id}:${status.pendingPrompt}:${status.pendingOptions.join('\0')}`)
        .join('\n')),
      distinctUntilChanged(),
    )
    .subscribe(() => {
      if (approvalsUi.active.value) rebuild()
    })

  approvalsUi.active.subscribe(active => {
    if (active) {
      rebuild()
      body.grab_focus()
    }
  })

  return (
    <window
      gdkmonitor={monitor}
      visible={binding(approvalsUi.active, false)}
      application={App}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.NORMAL}
      name={'agent-approvals'}
      keymode={Astal.Keymode.EXCLUSIVE}
      cssClasses={['agent-approval-window']}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
    >
      {body}
    </window>
  )
}
