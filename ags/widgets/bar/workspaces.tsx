import { range } from 'commons'
import Service from 'services'
import Gtk from 'gi://Gtk?version=4.0'
import { bindAs, binding } from 'rxbinding'
import { combineLatest, map, publish, switchMap } from 'rxjs'
import { bind } from 'astal'

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

const activeWs = workspaceService.activeWorkspace

const tabs = activeWs.pipe(switchMap(w => w.tabs))
const activeTab = activeWs.pipe(switchMap(w => w.selectedTab))

const tabString = combineLatest(tabs, activeTab).pipe(
  map(([tabs, activeTab]) =>
    tabs
      .sort((a, b) => a.id - b.id)
      .map(t => (activeTab.id == t.id ? `>${t.id}` : `${t.id}`))
      .join(' '),
  ),
)

export const Tabs = () => (
  <box>
    <label label={binding(tabString)} />
  </box>
)

export const Workspaces = () => (
  <box cssClasses={['workspaces', 'bar-widget']}>{workspaces()}</box>
)
