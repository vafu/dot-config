import { Astal, Gdk } from 'astal/gtk4'
import { WSIndicator } from './ws'
import obtainWmService from 'services'
import { delay, merge, of, shareReplay, switchMap } from 'rxjs'

const wsservice = await obtainWmService('workspace')

export const WSSideOverlay = (monitor: Gdk.Monitor) => {
  const reveal = wsservice.activeWorkspaceFor(monitor).pipe(
    switchMap(_ => merge(of(true), of(false).pipe(delay(1000)))),
    shareReplay(1),
  )

  const visible = reveal.pipe(
    switchMap(v => (v ? of(v) : of(v).pipe(delay(200)))),
  )

  return (
    <window
      visible={true}
      gdkmonitor={monitor}
      name={'WSOverlay'}
      css_classes={['wsoverlay']}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      hexpand={true}
      anchor={
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.BOTTOM
      }
    >
      <WSIndicator monitor={monitor} />
    </window>
  )
}
