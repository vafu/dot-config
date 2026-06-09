import Gio from 'gi://Gio?version=2.0'
import { Gdk, Gtk } from 'ags/gtk4'
import { distinctUntilChanged, map } from 'rxjs'
import { subscribeTo } from 'rxbinding'
import {
  WorkspaceModel,
  WorkspaceStatusProvider,
  WorkspaceWindowIndicatorModel,
} from 'services/workspace-status-provider'
import { LevelIndicator } from 'widgets/circularstatus'
import { MaterialIcon } from 'widgets/materialicon'
import { WidgetProps } from 'widgets'

const CONTEXT_STAGES = [
  { level: 0, class: 'normal' },
  { level: 50, class: 'warn' },
  { level: 75, class: 'high' },
  { level: 90, class: 'danger' },
  { level: 95, class: 'critical' },
]

const STYLE = { style: 'line' as const, thickness: 3 }

const sameArray = (left: string[], right: string[]) =>
  left.length === right.length
  && left.every((value, index) => value === right[index])

const windowClasses = (model: WorkspaceWindowIndicatorModel) =>
  model.cssClasses.concat([
    'workspace-window-tile',
    `workspace-window-${model.type}`,
  ])

const frameClasses = (model: WorkspaceWindowIndicatorModel) =>
  model.cssClasses.concat([
    'workspace-window-frame',
    `workspace-window-${model.type}`,
  ])

const sameRenderedWindow = (
  left: WorkspaceWindowIndicatorModel,
  right: WorkspaceWindowIndicatorModel,
) =>
  left.id === right.id
  && left.icon === right.icon
  && left.active === right.active
  && left.urgent === right.urgent
  && left.tooltip === right.tooltip
  && left.type === right.type
  && sameArray(windowClasses(left), windowClasses(right))
  && sameArray(frameClasses(left), frameClasses(right))
  && (left.type !== 'agent' || right.type !== 'agent'
    || (
      left.contextPct === right.contextPct
      && left.substatusCount === right.substatusCount
    ))

const sameRenderedWorkspace = (left: WorkspaceModel | null, right: WorkspaceModel | null) =>
  left?.key === right?.key
  && (left?.windows.length ?? 0) === (right?.windows.length ?? 0)
  && (left?.windows ?? []).every((window, index) => {
    const other = right?.windows[index]
    return !!other && sameRenderedWindow(window, other)
  })

const setImageIcon = (image: Gtk.Image, icon: string) => {
  if (!icon) {
    image.set_from_icon_name('application-x-executable-symbolic')
    return
  }

  const file = Gio.file_new_for_path(icon)
  if (file.query_exists(null)) {
    image.set_from_file(icon)
  } else {
    image.set_from_icon_name(icon)
  }
}

const syncClasses = (
  widget: Gtk.Widget,
  currentClasses: Set<string>,
  classes: string[],
) => {
  const nextClasses = new Set(classes)

  for (const cssClass of currentClasses) {
    if (!nextClasses.has(cssClass)) widget.remove_css_class(cssClass)
  }
  for (const cssClass of nextClasses) {
    if (!currentClasses.has(cssClass)) widget.add_css_class(cssClass)
  }

  return nextClasses
}

const WindowTile = (initial: WorkspaceWindowIndicatorModel) => {
  const plainImage = new Gtk.Image({
    pixelSize: 18,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
  })
  const agentIcon = new MaterialIcon({
    icon: initial.icon || 'smart_toy',
    tinted: false,
  })
  const level = new LevelIndicator({
    stages: CONTEXT_STAGES,
    style: STYLE,
    level: 0,
  })
  const agentInner = new Gtk.Box({
    cssClasses: ['agent-inner'],
  })
  agentInner.append(agentIcon)
  agentInner.append(level)

  const content = new Gtk.Box({
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    cssClasses: ['workspace-window-content'],
  })
  content.append(plainImage)
  content.append(agentInner)

  const surface = new Gtk.Box({
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    cssClasses: [],
  })
  surface.append(content)

  const agentBadge = new Gtk.Label({
    visible: false,
    halign: Gtk.Align.END,
    valign: Gtk.Align.START,
    cssClasses: ['agent-subagent-badge'],
  })

  const widget = new Gtk.Overlay({
    tooltipText: initial.id,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    cssClasses: [],
  })
  widget.set_child(surface)
  widget.add_overlay(agentBadge)

  let currentModel: WorkspaceWindowIndicatorModel | null = null
  let currentFrameClasses = new Set<string>()
  let currentSurfaceClasses = new Set<string>()
  let currentType = ''
  let currentPlainIcon = ''
  let currentAgentIcon = ''
  let currentTooltip = ''
  let currentContextPct = -1
  let currentBadgeLabel = ''
  let currentBadgeVisible = false

  const update = (model: WorkspaceWindowIndicatorModel) => {
    if (currentModel && sameRenderedWindow(currentModel, model)) return

    currentFrameClasses = syncClasses(widget, currentFrameClasses, frameClasses(model))
    currentSurfaceClasses = syncClasses(surface, currentSurfaceClasses, windowClasses(model))

    if (currentTooltip !== model.tooltip) {
      widget.set_tooltip_text(model.tooltip)
      currentTooltip = model.tooltip
    }

    if (currentType !== model.type) {
      plainImage.set_visible(model.type !== 'agent')
      agentInner.set_visible(model.type === 'agent')
      currentType = model.type
    }

    if (model.type === 'agent') {
      const icon = model.icon || 'smart_toy'
      if (currentAgentIcon !== icon) {
        agentIcon.icon = icon
        currentAgentIcon = icon
      }

      if (currentContextPct !== model.contextPct) {
        level.level = model.contextPct
        currentContextPct = model.contextPct
      }

      const badgeLabel = model.substatusCount > 9 ? '9+' : `${model.substatusCount}`
      if (currentBadgeLabel !== badgeLabel) {
        agentBadge.set_label(badgeLabel)
        currentBadgeLabel = badgeLabel
      }

      const badgeVisible = model.substatusCount > 0
      if (currentBadgeVisible !== badgeVisible) {
        agentBadge.set_visible(badgeVisible)
        currentBadgeVisible = badgeVisible
      }
    } else {
      if (currentPlainIcon !== model.icon) {
        setImageIcon(plainImage, model.icon)
        currentPlainIcon = model.icon
      }
      if (currentBadgeVisible) {
        agentBadge.set_visible(false)
        currentBadgeVisible = false
      }
    }

    currentModel = model
  }

  update(initial)
  widget['windowIndicatorId'] = initial.id
  widget['updateWindowIndicator'] = update
  return widget
}

export const WorkspaceWindowIndicators = (
  props: WidgetProps & { monitor: Gdk.Monitor },
) => {
  const provider = WorkspaceStatusProvider.forMonitor(props.monitor)
  const activeWorkspace$ = provider.models$.pipe(
    map(models => models.find(model => model.active) ?? models[0] ?? null),
    distinctUntilChanged(sameRenderedWorkspace),
  )
  const list = new Gtk.Box({
    spacing: 4,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    cssClasses: ['workspace-window-list'],
  })
  const container = new Gtk.Box({
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    cssClasses: (props.cssClasses ?? []).concat(['workspace-window-indicators']),
  })
  container.append(list)

  const widgets = new Map<string, Gtk.Widget>()
  let currentOrder: string[] = []

  subscribeTo(list, activeWorkspace$, (model, box) => {
    const windows = model?.windows ?? []
    const nextOrder = windows.map(window => window.id)
    const liveIds = new Set(windows.map(window => window.id))

    for (const [id, widget] of [...widgets.entries()]) {
      if (!liveIds.has(id)) {
        if (widget.get_parent() === box) box.remove(widget)
        widgets.delete(id)
      }
    }

    for (const window of windows) {
      let widget = widgets.get(window.id)
      if (!widget) {
        widget = WindowTile(window)
        widgets.set(window.id, widget)
      } else {
        widget['updateWindowIndicator']?.(window)
      }
    }

    if (!sameArray(currentOrder, nextOrder)) {
      let previous: Gtk.Widget | null = null
      for (const window of windows) {
        const widget = widgets.get(window.id)!
        if (widget.get_parent() === box) {
          box.reorder_child_after(widget, previous)
        } else {
          box.insert_child_after(widget, previous)
        }
        previous = widget
      }
      currentOrder = nextOrder
    }
  })

  return container
}
