import { binding, subscribeTo } from 'rxbinding'
import { combineLatest, map, startWith } from 'rxjs'
import { Gdk, Gtk } from 'ags/gtk4'
import { activeWorkspace$, activeWorkspaceForMonitor$, LocusWorkspace, workspacesOnMonitor$ } from 'services/locus'

const WorkspaceLabel = (props: { monitor: Gdk.Monitor, workspace: LocusWorkspace }) => {
  const ws = props.workspace
  // TODO when  monitor has never been selected yet -- we don't get correct 'active' status
  const active = combineLatest([
    activeWorkspaceForMonitor$(props.monitor),
    activeWorkspace$,
  ]).pipe(
    map(([active, focused]) => {
      if (ws == focused && ws == active) {
        return 'focused'
      } else if (ws == active) {
        return 'active'
      } else {
        return ''
      }
    }),
    startWith(''),
  )

  const offmonitor = workspacesOnMonitor$(props.monitor).pipe(
    map(wsa => {
      // TODO: bug when workspace being removed its monitor is null, this pipe crashes
      if (!wsa.includes(ws)) {
        return 'offmonitor'
      } else {
        return ''
      }
    }),
    startWith(''),
  )

  const classes = [
    // offmonitor,
    active,
    ws.occupied.pipe(map(a => (a ? 'occupied' : ''))),
    ws.urgent.pipe(map(a => (a ? 'urgent' : ''))),
  ]

  return (
    <label
      valign={Gtk.Align.CENTER}
      halign={Gtk.Align.CENTER}
      label={`${ws.externalId}`}
      cssClasses={binding(combineLatest(classes), [])}
    />
  ) as Gtk.Label
}

export const Workspaces = (props: { monitor: Gdk.Monitor }) => {
  const box = (<box cssClasses={['workspaces']} />) as Gtk.Box
  const widgets = new Map<string, Gtk.Widget>()

  subscribeTo(box, workspacesOnMonitor$(props.monitor), (workspaces, box) => {
    for (const widget of widgets.values()) box.remove(widget)

    for (const [subject] of [...widgets]) {
      if (!workspaces.some(workspace => workspace.subject === subject)) {
        widgets.delete(subject)
      }
    }

    for (const workspace of workspaces) {
      if (!widgets.has(workspace.subject)) {
        widgets.set(workspace.subject, WorkspaceLabel({ monitor: props.monitor, workspace }))
      }
      box.append(widgets.get(workspace.subject)!)
    }
  })

  return box
}
