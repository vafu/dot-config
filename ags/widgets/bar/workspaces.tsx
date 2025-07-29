import { range } from 'commons'
import Service from 'services'
import Gtk from 'gi://Gtk?version=4.0'
import { binding } from 'rxbinding'
import { combineLatest, filter, map, of, startWith, switchMap } from 'rxjs'
import { Gdk } from 'astal/gtk4'

const workspaceService = Service('workspace')

const workspaces = (props: { monitor: Gdk.Monitor }) =>
  range(7).map(idx => {
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
      startWith('')
    )

    return (
      <label
        valign={Gtk.Align.CENTER}
        halign={Gtk.Align.CENTER}
        label={`${ws}`}
        css_classes={binding(
          combineLatest([
            active,
            ws.urgent.pipe(map(a => a ? 'urgent' : '')),
            ws.occupied.pipe(map(a => a ? 'occupied' : '')),
          ]),
        )}
      />
    )
  })

export const Workspaces = (props: { monitor: Gdk.Monitor }) => (
  <box cssClasses={['workspaces', 'bar-widget']}>{workspaces(props)}</box>
)
