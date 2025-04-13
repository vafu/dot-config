import { exec, Variable } from 'astal'
import {
  batteryStatusFor,
  BluetoothDeviceType,
  BluetoothDeviceTypes,
  getDeviceType,
} from 'services/bluetooth'
import AstalBluetooth from 'gi://AstalBluetooth'
import { bindAs, binding, fromConnectable } from 'rxbinding'
import { filter, map, shareReplay, startWith, switchMap } from 'rxjs'
import { logNext } from 'commons/rx'

const CPU = Variable('0').poll(3000, () => exec('bash scripts/cpu.sh'))

const RAM = Variable('0').poll(3000, () => exec('bash scripts/ram.sh'))

const btDevices = fromConnectable(AstalBluetooth.get_default(), 'devices')

export const Status = () => (
  <box>
    <box cssClasses={['bar-widget']}>
      <image iconName="utilities-system-monitor-symbolic" />
      <label label={CPU().as((c) => c + '%')} />
    </box>

    <box cssClasses={['bar-widget']}>
      <image iconName="system-software-install-symbolic" />
      <label label={RAM().as((c) => c + '%')} />
    </box>
    {[
      BtDeviceBattery((t) => t === BluetoothDeviceTypes.INPUT_KEYBOARD),
      BtDeviceBattery((t) =>
        [
          BluetoothDeviceTypes.AUDIO_HEADPHONES,
          BluetoothDeviceTypes.AUDIO_HEADSET,
          BluetoothDeviceTypes.AUDIO_CARD,
        ].includes(t)
      ),
      BtDeviceBattery((t) =>
        [
          BluetoothDeviceTypes.INPUT_TABLET,
          BluetoothDeviceTypes.INPUT_MOUSE,
        ].includes(t)
      ),
    ]}
  </box>
)

function BtDeviceBattery(matcher: (c: BluetoothDeviceType) => Boolean) {
  const device = btDevices.pipe(
    map((devices) => devices.find((d) => matcher(getDeviceType(d)))),
    filter((d) => d != null),
    shareReplay(1)
  )

  const connected = device.pipe(
    switchMap((d) => fromConnectable(d, 'connected')),
    startWith(false)
  )

  const charge = batteryStatusFor(device)
  const icon = device.pipe(map((d) => getDeviceType(d).icon))

  return (
    <box cssClasses={['bar-widget']} visible={binding(connected)}>
      <image iconName={binding(icon)} />
      <label label={bindAs(charge, (a) => a.join('/'))} />
    </box>
  )
}
