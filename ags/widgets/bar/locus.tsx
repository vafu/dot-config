import { Gdk, Gtk } from 'ags/gtk4'
import { BehaviorSubject } from 'rxjs'
import { bindAs, subscribeTo } from 'rxbinding'
import { hintsMode$ } from 'services/hints'
import { WorkspaceModel, WorkspaceStatusProvider } from 'services/workspace-status-provider'
import { MaterialIcon } from 'widgets/materialicon'
import { WidgetProps } from 'widgets'
import { AgentWidget } from './agent'
import { Badged, PanelButtonGroup } from './panel-widgets'

const WorkspaceEntryWidget = (
  initial: WorkspaceModel,
  provider: WorkspaceStatusProvider,
) => {
  const icon = new MaterialIcon({
    icon: initial.collapsedIcon,
    tinted: false,
  })
  const primary = new Gtk.Label({
    label: initial.primaryText,
    xalign: 0,
    ellipsize: 3,
    maxWidthChars: 18,
    cssClasses: ['projects-primary', 'workspaces-primary'],
  })
  const delimiter = new Gtk.Label({
    label: '·',
    xalign: 0,
    visible: initial.secondaryVisible,
    cssClasses: ['projects-delimiter', 'workspaces-delimiter'],
  })
  const secondary = new Gtk.Label({
    label: initial.secondaryText,
    xalign: 0,
    visible: initial.secondaryVisible,
    ellipsize: 3,
    maxWidthChars: 18,
    cssClasses: ['projects-secondary', 'workspaces-secondary'],
  })

  const titleBox = new Gtk.Box({
    spacing: 4,
    halign: Gtk.Align.START,
    cssClasses: ['projects-title', 'workspaces-title'],
  })
  titleBox.append(primary)
  titleBox.append(delimiter)
  titleBox.append(secondary)

  const collapsedIcon = new Gtk.Box({
    cssClasses: ['projects-collapsed-icon', 'workspaces-collapsed-icon'],
  })
  collapsedIcon.append(icon)

  const rootButton = new Gtk.Button({
    tooltipText: initial.tooltip,
    cssClasses: ['projects-root-button', 'workspaces-root-button'],
    child: collapsedIcon,
  })

  const childSignature = (model: WorkspaceModel) =>
    model.children.map(child => `${child.kind}:${child.id}:${child.cssClasses.join(',')}`).join('\0')

  const agentWidgets = initial.children
    .filter(child => child.kind === 'agent-session')
    .map(child => AgentWidget(child.id, provider.childSubstatusCount$(child.id)))
  const revealed$ = new BehaviorSubject(initial.active)
  const workspaceNumber$ = new BehaviorSubject(`${initial.sortIndex}`)

  const group = PanelButtonGroup({
    cssClasses: initial.cssClasses,
    expandDirection: 'right',
    revealWhen: revealed$,
    children: [rootButton, titleBox, ...agentWidgets],
  }) as Gtk.Box

  const widget = Badged({
    child: group,
    badges: [{
      label: workspaceNumber$,
      visible: hintsMode$,
      cssClasses: ['workspace-number-badge'],
    }],
  })

  const syncClasses = (model: WorkspaceModel) => {
    for (const cssClass of [
      'current-workspace',
      'has-attention',
      'all-idle',
      'has-working',
      'has-complete',
    ]) {
      group.remove_css_class(cssClass)
    }

    for (const cssClass of model.cssClasses) {
      group.add_css_class(cssClass)
    }
  }

  const update = (model: WorkspaceModel) => {
    revealed$.next(model.active)
    syncClasses(model)
    rootButton.set_tooltip_text(model.tooltip)
    icon.icon = model.collapsedIcon
    workspaceNumber$.next(`${model.sortIndex}`)
    primary.set_label(model.primaryText)
    secondary.set_label(model.secondaryText)
    delimiter.set_visible(model.secondaryVisible)
    secondary.set_visible(model.secondaryVisible)
  }

  update(initial)
  widget['workspaceModelKey'] = initial.key
  widget['workspaceChildSignature'] = childSignature(initial)
  widget['updateWorkspaceModel'] = update
  return widget
}

export const WorkspacesWidget = (props: WidgetProps & { monitor: Gdk.Monitor }) => {
  const provider = WorkspaceStatusProvider.forMonitor(props.monitor)
  const list = (
    <box
      cssClasses={(props.cssClasses ?? []).concat([
        'projects-widget',
        'workspaces-widget',
        'projects-list',
        'workspaces-list',
      ])}
      halign={Gtk.Align.CENTER}
      spacing={4}
      visible={bindAs(provider.models$, models => models.length > 0, false)}
    />
  ) as Gtk.Box
  const widgets = new Map<string, Gtk.Widget>()
  const childSignature = (model: WorkspaceModel) =>
    model.children.map(child => `${child.kind}:${child.id}:${child.cssClasses.join(',')}`).join('\0')

  subscribeTo(list, provider.models$, (models, box) => {
    const liveKeys = new Set(models.map(model => model.key))
    for (const [key, widget] of [...widgets.entries()]) {
      if (!liveKeys.has(key)) {
        if (widget.get_parent() === box) box.remove(widget)
        widgets.delete(key)
      }
    }

    let previous: Gtk.Widget | null = null
    for (const model of models) {
      const signature = childSignature(model)
      let widget = widgets.get(model.key)
      if (!widget || widget['workspaceChildSignature'] !== signature) {
        if (widget?.get_parent() === box) box.remove(widget)
        widget = WorkspaceEntryWidget(model, provider)
        widgets.set(model.key, widget)
      } else {
        widget['updateWorkspaceModel']?.(model)
      }
      if (widget.get_parent() === box) {
        box.reorder_child_after(widget, previous)
      } else {
        box.insert_child_after(widget, previous)
      }
      previous = widget
    }
  })

  return list
}
