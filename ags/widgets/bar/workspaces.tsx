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
      switchMap(w =>
        combineLatest(
          of(w),
          workspaceService.activeWorkspace,
          workspaceService.workspacesOn(props.monitor),
        ),
      ),
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
        if (!wsa.includes(ws)) {
          return 'offmonitor'
        } else {
          return ''
        }
      }),
      startWith(''),
    )

    return (
      <label
        valign={Gtk.Align.CENTER}
        halign={Gtk.Align.CENTER}
        label={`${ws}`}
        css_classes={binding(
          combineLatest([
            offmonitor,
            active,
            ws.urgent.pipe(map(a => (a ? 'urgent' : ''))),
            ws.occupied.pipe(map(a => (a ? 'occupied' : ''))),
          ]),
        )}
      />
    )
  })

export const Workspaces = (props: { monitor: Gdk.Monitor }) => (
  <box cssClasses={['workspaces', 'bar-widget']}>{workspaces(props)}</box>
)
