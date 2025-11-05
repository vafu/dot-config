import { range } from 'commons'
import Gtk from 'gi://Gtk?version=4.0'
import { binding } from 'rxbinding'
import { combineLatest, map, of, startWith, switchMap } from 'rxjs'
import { Gdk } from 'astal/gtk4'
import obtainWmService from 'services'

const workspaceService = await obtainWmService('workspace')

const workspaces = (props: { monitor: Gdk.Monitor }) =>
  range(5).map(idx => {
    const ws = workspaceService.getWorkspace(idx)
    // TODO when  monitor has never been selected yet -- we don't get correct 'active' status
    const active = workspaceService.activeWorkspaceFor(props.monitor).pipe(
      switchMap(w => combineLatest(of(w), workspaceService.activeWorkspace)),
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

    const offmonitor = workspaceService.workspacesOn(props.monitor).pipe(
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
        label={`${ws}`}
        cssClasses={binding(combineLatest(classes))}
      />
    )
  })

export const Workspaces = (props: { monitor: Gdk.Monitor }) => (
  <box cssClasses={['workspaces']}>{workspaces(props)}</box>
)
