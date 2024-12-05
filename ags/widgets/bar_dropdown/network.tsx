import AstalNetwork from 'gi://AstalNetwork?version=0.1'
import { binding, obs } from 'rxbinding'
import { Quicktoggle } from './quicktoggle'
import { bind } from 'astal'
import { Observable } from 'rx'

const network = AstalNetwork.get_default()
const wifi = obs(network, 'wifi').shareReplay(1)

export function NetworkQuicktoggle() {
  const wifiEnabled = wifi.flatMapLatest((w) => obs(w, 'enabled'))
  const label = wifiEnabled.flatMapLatest((enabled) =>
    enabled
      ? wifi.flatMapLatest((w) => obs(w, 'ssid'))
      : Observable.just('WiFi off')
  )

  return (
    <Quicktoggle
      enabled={binding(wifiEnabled)}
      hasExtra={binding(wifiEnabled)}
      onClicked={() =>
        network.get_wifi().set_enabled(!network.get_wifi().get_enabled())
      }
      iconName={bind(network.wifi, 'iconName')}
      label={binding(label)}
    />
  )
}
