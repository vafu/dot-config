import App from 'ags/gtk4/app'
import { Astal, Gdk } from 'ags/gtk4'
import { Hidden, OnScreenProgress } from './OSD'
import { binding, fromConnectable, asObservable } from 'rxbinding'
import obtainWmService from 'services'
import AstalWp from 'gi://AstalWp?version=0.1'
import { catchError, combineLatest, delay, map, merge, NEVER, of, switchMap } from 'rxjs'
import { Accessor } from 'gnim'
import { logNext } from 'commons/rx'
const service = await obtainWmService('brightness')
const brightness = fromConnectable(service, 'screen').pipe(
  map(b => ({
    type: 'level' as const,
    value: b,
    iconName: 'display-brightness-symbolic',
  })),
  catchError(err => {
    console.error('Brightness error:', err)
    return NEVER
  }),
)
const audio = fromConnectable(AstalWp.get_default()!!, 'default_speaker').pipe(
  switchMap(s =>
    combineLatest([
      fromConnectable(s, 'volume'),
      fromConnectable(s, 'volume_icon'),
    ]),
  ),
  map(([volume, icon]) => ({
    type: 'level' as const,
    value: volume,
    iconName: icon,
  })),
)

export default function OSD(monitor: Accessor<Gdk.Monitor>) {
  const source = merge(audio, brightness).pipe(
    switchMap(s => merge(of(s), of(Hidden).pipe(delay(1000)))),
  )

  const visible = source.pipe(
    delay(100),
    map(s => s != Hidden),
  )

  const monitorBinding = binding(
    asObservable(monitor).pipe(
      logNext(m => `OSD monitor: ${m ? m.constructor.name : 'null'}`),
    ),
    monitor.get(),
  )

  console.log('OSD: Creating window with monitor:', monitor.get())

  return (
    <window
      visible={binding(visible, false)}
      gdkmonitor={monitorBinding}
      cssClasses={['OSD']}
      name={'OSD'}
      application={App}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      focusable={false}
      anchor={Astal.WindowAnchor.BOTTOM}
    >
      <OnScreenProgress states={source} />
    </window>
  )
}







