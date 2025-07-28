import { range } from 'commons'
import Service from 'services'
import Gtk from 'gi://Gtk?version=4.0'
import { binding } from 'rxbinding'
import { combineLatest, map } from 'rxjs'

const workspaceService = Service('workspace')

const workspaces = () =>
  range(7).map(idx => {
    const ws = workspaceService.getWorkspace(idx)
    return (
      <label
        valign={Gtk.Align.CENTER}
        halign={Gtk.Align.CENTER}
        label={`${ws}`}
        css_classes={binding(
          combineLatest([
            ws.active.pipe(map(a => (a ? 'active' : ''))),
            ws.urgent.pipe(map(a => (a ? 'urgent' : ''))),
            ws.occupied.pipe(map(a => (a ? 'occupied' : ''))),
          ]),
        )}
      />
    )
  })

export const Workspaces = () => (
  <box cssClasses={['workspaces', 'bar-widget']}>{workspaces()}</box>
)
