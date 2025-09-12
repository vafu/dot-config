import { Astal, Gdk } from 'ags/gtk4'
import app from "ags/gtk4/app"
import { Hidden, OnScreenProgress, State } from './OSD'
import { binding, fromConnectable } from 'rxbinding'
import obtainWmService from 'services'
import AstalWp from 'gi://AstalWp?version=0.1'
import {
  combineLatest,
  delay,
  map,
  merge,
  Observable,
  of,
  switchMap,
} from 'rxjs'
import { Binding } from 'astal'

const brightness = fromConnectable(obtainWmService('brightness'), 'screen').pipe(
  map((b) => ({
    type: 'level',
    value: b,
    iconName: 'display-brightness-symbolic',
  }))
)
const audio = fromConnectable(AstalWp.get_default(), 'default_speaker').pipe(
  switchMap((s) =>
    combineLatest([
      fromConnectable(s, 'volume'),
      fromConnectable(s, 'volume_icon'),
    ])
  ),
  map(([volume, icon]) => ({
    type: 'level',
    value: volume,
    iconName: icon,
  }))
)

export default function OSD(monitor: Binding<Gdk.Monitor>) {
  const source = merge(audio, brightness).pipe(
    switchMap((s) => merge(of(s), of(Hidden).pipe(delay(2000))))
  )

  const visible = source.pipe(
    delay(100),
    map((s) => s != Hidden)
  )

  return (
    <window
      visible={binding(visible)}
      gdkmonitor={monitor}
      cssClasses={['OSD']}
      name={'OSD'}
      application={app}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      focusable={false}
      anchor={Astal.WindowAnchor.BOTTOM}
    >
      <OnScreenProgress states={source} />
    </window>
  )
}
