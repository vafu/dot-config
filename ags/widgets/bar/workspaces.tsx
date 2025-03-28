import { range } from 'commons'
import Service from 'services'
import Gtk from 'gi://Gtk?version=4.0'
import { binding } from 'rxbinding'
import { Observable } from 'rx'

const workspaceService = Service('workspace')

const workspaces = () => 
   range(7).map((idx) => {
  const ws = workspaceService.activeWorkroom.map((wr) => wr.getWs(idx))
  return (
    <label
      valign={Gtk.Align.CENTER}
      halign={Gtk.Align.CENTER}
      label={`${ws}`}
      css_classes={binding(
        Observable.combineLatest(
          ws.flatMapLatest((w) => w.active).map((a) => (a ? 'active' : '')),
          ws.flatMapLatest((w) => w.urgent).map((a) => (a ? 'urgent' : '')),
          ws.flatMapLatest((w) => w.occupied).map((a) => (a ? 'occupied' : ''))
        )
      )}
    />
  )
})

export const Workspaces = () => {
  return <box cssClasses={['workspaces', 'bar-widget']}>{workspaces()}</box>
}
