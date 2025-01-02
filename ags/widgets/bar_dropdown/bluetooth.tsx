import { Quicktoggle } from './quicktoggle'
import { bind } from 'astal'
import AstalBluetooth from 'gi://AstalBluetooth?version=0.1'

const bluetooth = AstalBluetooth.get_default()

export function BluetoothQuicktoggle() {
  const btEnabled = bind(bluetooth, 'is_powered')
  // const label = wifiEnabled.flatMapLatest((enabled) =>
  //   enabled
  //     ? wifi.flatMapLatest((w) => obs(w, 'ssid'))
  //     : Observable.just('Disabled')
  // )

  return (
    <Quicktoggle
      enabled={btEnabled}
      hasExtra={btEnabled}
      iconName={"bluetooth"}
      label={"Bluetooth"}
    />
  )
}
