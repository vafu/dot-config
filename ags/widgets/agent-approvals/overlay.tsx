import App from 'ags/gtk4/app'
import { Accessor } from 'gnim'
import { Astal, Gdk, Gtk } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'
import GtkSource from 'gi://GtkSource?version=5'
import GLib from 'gi://GLib?version=2.0'
import { bindAs, binding, subscribeTo } from 'rxbinding'
import { getAgentService, AgentStatus } from 'services/agent'
import { locus } from 'services/locus.generated'
import approvalsUi from 'widgets/agent-approvals'
import { MaterialIcon } from 'widgets/materialicon'
import { combineLatest, map, distinctUntilChanged } from 'rxjs'

type PendingApproval = {
  sessionId: string
  requestId: string
  status: AgentStatus
  prompt: string
  detailKind: string
  detailText: string
  options: string[]
  optionDescriptions: string[]
}

const prettyPath = (path: string) => path ? path.replace(/^\/home\/[^/]+/, '~') : 'unknown cwd'
const approvalOptions = (request: PendingApproval) =>
  request.options.length > 0 ? request.options : ['Allow', 'Deny']
const approvalOptionDescriptions = (request: PendingApproval) =>
  request.optionDescriptions.length > 0
    ? request.optionDescriptions
    : approvalOptions(request).map(() => '')
const approvalSignature = (request: PendingApproval) =>
  `${request.sessionId}:${request.requestId}:${request.prompt}:${request.detailKind}:${request.detailText}:${approvalOptions(request).join('\0')}:${approvalOptionDescriptions(request).join('\0')}`

function requestsForSession(sessionId: string, status: AgentStatus): PendingApproval[] {
  if (!status.requiresAttention) return []

  if (status.pendingRequestIds.length > 0) {
    return status.pendingRequestIds.map((requestId, idx) => ({
      sessionId,
      requestId,
      status,
      prompt: status.pendingPrompts[idx] ?? status.pendingPrompt,
      detailKind: status.pendingDetailKinds[idx] ?? status.pendingDetailKind,
      detailText: status.pendingDetailTexts[idx] ?? status.pendingDetailText,
      options: status.pendingOptionsList[idx] ?? status.pendingOptions,
      optionDescriptions: status.pendingOptionDescriptionsList[idx] ?? status.pendingOptionDescriptions,
    })).filter(request => request.prompt)
  }

  if (!status.pendingPrompt) return []
  return [{
    sessionId,
    requestId: '',
    status,
    prompt: status.pendingPrompt,
    detailKind: status.pendingDetailKind,
    detailText: status.pendingDetailText,
    options: status.pendingOptions,
    optionDescriptions: status.pendingOptionDescriptions,
  }]
}

function pendingApprovals(): PendingApproval[] {
  return [...getAgentService().sessions$.value.entries()]
    .flatMap(([sessionId, status]) => requestsForSession(sessionId, status))
}

const nativeDiffSchemeId = 'agent-native-diff'
let nativeDiffSchemeSignature = ''

type RgbaLike = {
  red: number
  green: number
  blue: number
  alpha: number
}

function fallbackColor(value: string): RgbaLike {
  const color = new Gdk.RGBA()
  color.parse(value)
  return color
}

function lookupColor(widget: Gtk.Widget, names: string[], fallback: string): RgbaLike {
  const context = widget.get_style_context()
  for (const name of names) {
    const [found, color] = context.lookup_color(name)
    if (found) return color
  }
  return fallbackColor(fallback)
}

function mixColor(base: RgbaLike, tint: RgbaLike, amount: number): RgbaLike {
  const keep = 1 - amount
  return {
    red: base.red * keep + tint.red * amount,
    green: base.green * keep + tint.green * amount,
    blue: base.blue * keep + tint.blue * amount,
    alpha: 1,
  }
}

function colorToHex(color: RgbaLike) {
  const channel = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`
}

function nativeDiffStyleScheme(widget: Gtk.Widget) {
  const fg = lookupColor(widget, ['theme_fg_color', 'view_fg_color'], '#eeeeec')
  const bg = lookupColor(widget, ['sidebar_bg_color', 'theme_bg_color', 'view_bg_color'], '#242424')
  const muted = mixColor(bg, fg, 0.58)
  const accent = lookupColor(widget, ['accent_color'], '#3584e4')
  const success = lookupColor(widget, ['success_bg_color', 'green_4'], '#2ec27e')
  const danger = lookupColor(widget, ['error_bg_color', 'destructive_bg_color', 'red_4'], '#e01b24')
  const warning = lookupColor(widget, ['warning_bg_color', 'yellow_4'], '#f5c211')
  const selectionBg = lookupColor(widget, ['accent_bg_color', 'accent_color'], '#3584e4')
  const selectionFg = lookupColor(widget, ['accent_fg_color'], '#ffffff')
  const addBg = mixColor(bg, success, 0.22)
  const removeBg = mixColor(bg, danger, 0.20)
  const hunkBg = mixColor(bg, accent, 0.18)
  const fileBg = mixColor(bg, warning, 0.12)

  const colors = {
    fg: colorToHex(fg),
    bg: colorToHex(bg),
    muted: colorToHex(muted),
    accent: colorToHex(accent),
    success: colorToHex(success),
    danger: colorToHex(danger),
    warning: colorToHex(warning),
    selectionBg: colorToHex(selectionBg),
    selectionFg: colorToHex(selectionFg),
    addBg: colorToHex(addBg),
    removeBg: colorToHex(removeBg),
    hunkBg: colorToHex(hunkBg),
    fileBg: colorToHex(fileBg),
  }
  const signature = Object.values(colors).join(':')
  const manager = GtkSource.StyleSchemeManager.get_default()

  if (signature !== nativeDiffSchemeSignature) {
    const schemeDir = `${GLib.get_user_data_dir()}/gtksourceview-5/styles`
    const schemePath = `${schemeDir}/${nativeDiffSchemeId}.xml`
    GLib.mkdir_with_parents(schemeDir, 0o755)
    GLib.file_set_contents(schemePath, `<?xml version="1.0" encoding="UTF-8"?>
<style-scheme id="${nativeDiffSchemeId}" name="Agent Native Diff" version="1.0" parent-scheme="Adwaita-dark">
  <author>agent-dbus</author>
  <description>Diff colors generated from the active GTK theme.</description>

  <color name="fg" value="${colors.fg}"/>
  <color name="bg" value="${colors.bg}"/>
  <color name="muted" value="${colors.muted}"/>
  <color name="accent" value="${colors.accent}"/>
  <color name="success" value="${colors.success}"/>
  <color name="danger" value="${colors.danger}"/>
  <color name="warning" value="${colors.warning}"/>
  <color name="selection-bg" value="${colors.selectionBg}"/>
  <color name="selection-fg" value="${colors.selectionFg}"/>
  <color name="add-bg" value="${colors.addBg}"/>
  <color name="remove-bg" value="${colors.removeBg}"/>
  <color name="hunk-bg" value="${colors.hunkBg}"/>
  <color name="file-bg" value="${colors.fileBg}"/>

  <style name="text" foreground="fg" background="bg"/>
  <style name="selection" foreground="selection-fg" background="selection-bg"/>
  <style name="selection-unfocused" foreground="fg" background="hunk-bg"/>
  <style name="cursor" foreground="fg"/>
  <style name="line-numbers" foreground="muted" background="bg"/>
  <style name="right-margin" foreground="muted" background="bg"/>

  <style name="def:comment" foreground="muted"/>
  <style name="def:keyword" foreground="accent" bold="true"/>
  <style name="def:preprocessor" foreground="accent"/>
  <style name="def:string" foreground="success"/>
  <style name="def:type" foreground="warning"/>

  <style name="diff:added-line" foreground="success" line-background="add-bg"/>
  <style name="diff:removed-line" foreground="danger" line-background="remove-bg"/>
  <style name="diff:changed-line" foreground="warning"/>
  <style name="diff:special-case" foreground="warning"/>
  <style name="diff:location" foreground="accent" line-background="hunk-bg" bold="true"/>
  <style name="diff:ignore" foreground="muted"/>
  <style name="diff:diff-file" foreground="fg" line-background="file-bg" bold="true"/>
</style-scheme>
`)
    nativeDiffSchemeSignature = signature
    manager.force_rescan()
  }

  return manager.get_scheme(nativeDiffSchemeId)
}

function makeDiffDetailView(diffText: string) {
  return makeSourceDetailView(diffText, 'diff')
}

function makeSourceDetailView(text: string, languageId: string) {
  const buffer = new GtkSource.Buffer()
  const language = GtkSource.LanguageManager.get_default().get_language(languageId)
  const lineCount = Math.max(1, text.split('\n').length)

  if (language) buffer.set_language(language)
  buffer.set_highlight_syntax(true)
  buffer.set_text(text, -1)

  const view = new GtkSource.View({
    buffer,
    editable: false,
    cursorVisible: false,
    monospace: true,
    hexpand: true,
    heightRequest: Math.min(344, Math.max(28, lineCount * 22) + 24),
    backgroundPattern: GtkSource.BackgroundPatternType.NONE,
    showLineNumbers: false,
    showLineMarks: false,
    wrapMode: Gtk.WrapMode.NONE,
    pixelsAboveLines: 0,
    pixelsBelowLines: 0,
    pixelsInsideWrap: 0,
    topMargin: 12,
    bottomMargin: 12,
    leftMargin: 12,
    rightMargin: 12,
    cssClasses: [
      'agent-approval-detail',
      'agent-approval-detail-surface',
      'agent-approval-detail-monospace',
    ],
  })
  const scheme = nativeDiffStyleScheme(view)
  if (scheme) buffer.set_style_scheme(scheme)
  return view
}

function makeOptionButton(
  label: string,
  description: string,
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
  const text = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, hexpand: true })
  text.append(new Gtk.Label({ label, xalign: 0, hexpand: true, wrap: true }))
  if (description) {
    text.append(new Gtk.Label({
      label: description,
      xalign: 0,
      hexpand: true,
      wrap: true,
      cssClasses: ['agent-approval-option-detail'],
    }))
  }
  row.append(text)
  button.set_child(row)
  button.connect('clicked', () => {
    select(idx)
    answer()
  })
  button.connect('notify::has-focus', () => {
    if (button.has_focus) select(idx)
  })
  if (idx === selected()) button.add_css_class('selected')
  return button
}

function makeDetailView(request: PendingApproval): Gtk.Widget | null {
  if (!request.detailText) return null
  if (request.detailKind === 'diff') {
    return makeDiffDetailView(request.detailText)
  }
  if (request.detailKind === 'command') {
    return makeSourceDetailView(request.detailText, 'sh')
  }

  const isStructured = ['diff', 'command', 'json'].includes(request.detailKind)
  const detailView = new Gtk.TextView({
    editable: false,
    cursorVisible: false,
    monospace: isStructured,
    wrapMode: isStructured ? Gtk.WrapMode.NONE : Gtk.WrapMode.WORD_CHAR,
    topMargin: 12,
    bottomMargin: 12,
    leftMargin: 12,
    rightMargin: 12,
    cssClasses: [
      'agent-approval-detail',
      'agent-approval-detail-surface',
      isStructured ? 'agent-approval-detail-monospace' : 'agent-approval-detail-text',
    ],
  })
  detailView.get_buffer().set_text(request.detailText, -1)
  return detailView
}

export function AgentApprovalOverlay(monitor: Accessor<Gdk.Monitor>) {
  const { sessions$, respondToElicitation } = getAgentService()
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
    respondToElicitation(request.sessionId, answer, request.requestId)
    requests = requests.filter(r => r.sessionId !== request.sessionId || r.requestId !== request.requestId)
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

  const scrollToTarget = () => {
    const target = approvalsUi.targetSession.value
    if (!target) return
    const idx = requests.findIndex(r => r.sessionId === target)
    if (idx < 0 || !cards[idx]) return
    carousel.scroll_to(cards[idx], false)
  }

  const currentOptions = () => {
    const request = selectedRequest()
    return request ? approvalOptions(request) : []
  }

  const answerSelected = () => {
    const request = selectedRequest()
    if (!request) return
    const options = approvalOptions(request)
    choose(request, options[Math.min(selectedOption, options.length - 1)])
  }

  const scrollBy = (delta: number) => {
    const next = Math.max(0, Math.min(cards.length - 1, Math.round(carousel.get_position()) + delta))
    carousel.scroll_to(cards[next], true)
    selectedOption = 0
    refreshSelection()
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
      const options = approvalOptions(request)
      const optionDescriptions = approvalOptionDescriptions(request)
      const agentSessionNode = `agent-session:${request.sessionId}`
      const projectIcon$ = combineLatest([
        locus.agentSessionWorkspaceProjectProperty$(agentSessionNode, 'icon'),
        locus.agentSessionProjectProperty$(agentSessionNode, 'icon'),
      ]).pipe(
        map(([workspaceIcon, directIcon]) => workspaceIcon || directIcon || 'smart_toy'),
        distinctUntilChanged(),
      )
      const detailView = makeDetailView(request)
      const contentBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      })
      contentBox.append(new Gtk.Label({
        label: request.prompt,
        xalign: 0,
        wrap: true,
        maxWidthChars: 92,
        cssClasses: ['agent-approval-prompt'],
      }))
      if (detailView) contentBox.append(detailView)
      const contentScroll = new Gtk.ScrolledWindow({
        hscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
        vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
        propagateNaturalHeight: false,
        maxContentHeight: 620,
        vexpand: true,
        child: contentBox,
        cssClasses: ['agent-approval-content-scroll'],
      })
      const optionBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 8,
      })

      options.forEach((option, idx) => {
        const button = makeOptionButton(
          option,
          optionDescriptions[idx] ?? '',
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
          hexpand={true}
          vexpand={true}
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
          {contentScroll}
          {optionBox}
        </box>
      ) as Gtk.Widget

      cards.push(card)
      carousel.append(card)
    }

    scrollToTarget()
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
      scrollBy(-1)
      return true
    }
    if (keyval === Gdk.KEY_Right || keyval === Gdk.KEY_l) {
      scrollBy(1)
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
        const requestOptions = approvalOptions(request)
        if (idx < requestOptions.length) choose(request, requestOptions[idx])
      }
      return true
    }
    return false
  })
  body.add_controller(keyController)

  subscribeTo(body, sessions$
    .pipe(
      map(s => [...s.entries()]
        .flatMap(([id, status]) => requestsForSession(id, status))
        .map(request => approvalSignature(request))
        .join('\n')),
      distinctUntilChanged(),
    ), () => {
    if (approvalsUi.active.value) rebuild()
  })

  subscribeTo(body, approvalsUi.active, active => {
    if (active) {
      rebuild()
      body.grab_focus()
    }
  })

  subscribeTo(body, approvalsUi.targetSession.pipe(distinctUntilChanged()), () => {
    if (approvalsUi.active.value) scrollToTarget()
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
