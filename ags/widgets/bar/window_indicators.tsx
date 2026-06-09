import Gio from 'gi://Gio?version=2.0'
import { Gdk, Gtk } from 'ags/gtk4'
import { map, distinctUntilChanged } from 'rxjs'
import { subscribeTo } from 'rxbinding'
import {
  WorkspaceModel,
  WorkspaceStatusProvider,
  WorkspaceWindowIndicatorModel,
} from 'services/workspace-status-provider'
import { WidgetProps } from 'widgets'

const sameActiveWorkspace = (left: WorkspaceModel | null, right: WorkspaceModel | null) =>
  left?.key === right?.key
  && left?.windowSummary.count === right?.windowSummary.count
  && left?.windowSummary.activeCount === right?.windowSummary.activeCount
  && left?.windowSummary.hasUrgent === right?.windowSummary.hasUrgent
  && left?.windows.length === right?.windows.length
  && (left?.windows ?? []).every((window, index) => {
    const other = right?.windows[index]
    return !!other
      && window.id === other.id
      && window.icon === other.icon
      && window.active === other.active
      && window.urgent === other.urgent
      && window.x === other.x
      && window.y === other.y
      && window.width === other.width
      && window.height === other.height
      && window.type === other.type
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

const syncClasses = (widget: Gtk.Widget, model: WorkspaceWindowIndicatorModel) => {
  widget.set_css_classes(model.cssClasses.concat([
    'workspace-window-tile',
    `workspace-window-${model.type}`,
  ]))
}

const WindowTile = (initial: WorkspaceWindowIndicatorModel) => {
  const image = new Gtk.Image({
    pixelSize: 18,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
  })

  const widget = new Gtk.Box({
    tooltipText: initial.id,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    cssClasses: [],
  })
  widget.append(image)

  const update = (model: WorkspaceWindowIndicatorModel) => {
    syncClasses(widget, model)
    widget.set_tooltip_text(model.id)
    setImageIcon(image, model.icon)
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
    distinctUntilChanged(sameActiveWorkspace),
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

  subscribeTo(list, activeWorkspace$, (model, box) => {
    const windows = model?.windows ?? []
    const liveIds = new Set(windows.map(window => window.id))

    for (const [id, widget] of [...widgets.entries()]) {
      if (!liveIds.has(id)) {
        if (widget.get_parent() === box) box.remove(widget)
        widgets.delete(id)
      }
    }

    let previous: Gtk.Widget | null = null
    for (const window of windows) {
      let widget = widgets.get(window.id)
      if (!widget) {
        widget = WindowTile(window)
        widgets.set(window.id, widget)
      } else {
        widget['updateWindowIndicator']?.(window)
      }

      if (widget.get_parent() === box) {
        box.reorder_child_after(widget, previous)
      } else {
        box.insert_child_after(widget, previous)
      }
      previous = widget
    }
  })

  return container
}
