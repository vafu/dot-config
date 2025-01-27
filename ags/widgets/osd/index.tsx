import { App, Astal, Gdk } from 'astal/gtk4'
import { Hidden, OnScreenProgress, State } from './OSD'
import { obs } from 'rxbinding'
import obtainService from 'services'
import AstalWp from 'gi://AstalWp?version=0.1'
import { Observable } from 'rx'

const brightness = obs(obtainService('brightness'), 'screen').map((b) => ({
  type: 'level',
  value: b,
  iconName: 'display-brightness-symbolic',
}))

const audio = obs(AstalWp.get_default(), 'default_speaker')
  .flatMapLatest((s) =>
    Observable.combineLatest(obs(s, 'volume'), obs(s, 'volume_icon'))
  )
  .map(([volume, icon]) => ({
    type: 'level',
    value: volume,
    iconName: icon,
  }))

export default function OSD(monitor: Gdk.Monitor) {
  const source = Observable.merge(
    audio,
    brightness
  ).flatMapLatest((s) =>
    Observable.merge<State>(
      Observable.just(s),
      Observable.just(Hidden).delay(2000)
    )
  )

  return (
    <window
      visible={true}
      gdkmonitor={monitor}
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
