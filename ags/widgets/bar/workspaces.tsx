import { range } from 'commons'
import Service from 'services'
import Gtk from 'gi://Gtk?version=4.0'
import { binding } from 'rxbinding'
import { combineLatest, map, switchMap } from 'rxjs'

const workspaceService = Service('workspace')

const workspaces = () =>
  range(7).map((idx) => {
    const ws = workspaceService.activeWorkroom.pipe(map((wr) => wr.getWs(idx)))
    return (
      <label
        valign={Gtk.Align.CENTER}
        halign={Gtk.Align.CENTER}
        label={`${ws}`}
        css_classes={binding(
          combineLatest([
            ws.pipe(
              switchMap((w) => w.active),
              map((a) => (a ? 'active' : ''))
            ),
            ws.pipe(
              switchMap((w) => w.urgent),
              map((a) => (a ? 'urgent' : ''))
            ),
            ws.pipe(
              switchMap((w) => w.occupied),
              map((a) => (a ? 'occupied' : ''))
            ),
          ])
        )}
      />
    )
  })

export const Workspaces = () => {
  return <box cssClasses={['workspaces', 'bar-widget']}>{workspaces()}</box>
}
