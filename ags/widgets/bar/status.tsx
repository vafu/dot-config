import { Gio, readFile } from 'astal'
import { AstalIO, bind, exec, Variable } from 'astal'
import { batteryStatusFor, BluetoothDeviceType, getDeviceType } from 'commons/bluetooth'
import AstalBluetooth from 'gi://AstalBluetooth'
import { binding, obs } from 'rxbinding'

const CPU = Variable('0').poll(3000, () => exec('bash scripts/cpu.sh'))
const RAM = Variable('0').poll(3000, () => exec('bash scripts/ram.sh'))


const btDevices = obs(AstalBluetooth.get_default(), 'devices')
  .map(devices => devices.map(d => ({ device: d, type: getDeviceType(d) })))
  .shareReplay(1)

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
      SplitKb(),
      BtDeviceBattery(t => [BluetoothDeviceType.AUDIO_HEADPHONES, BluetoothDeviceType.AUDIO_HEADSET].includes(t)),
      BatteryFromHid('input-touchpad-symbolic', ''),
    ]}
  </box>
)

function BatteryFromHid(icon: string, hid: string) {
  const path = '/sys/class/power_supply/hid-08:65:18:b9:2b:96-battery/capacity'
  const file = Gio.file_new_for_path(path)
  const exists = file.query_exists(null)
  const capacity = Variable(exists ? readFile(path) : '0')
  const visible = Variable(exists)
  AstalIO.monitor_file(path, (f: string, event: Gio.FileMonitorEvent) => {
    console.log(event)
    if (event == Gio.FileMonitorEvent.CHANGED || Gio.FileMonitorEvent.CREATED) {
      visible.set(true)
      capacity.set(readFile(f))
    }
    if (event == Gio.FileMonitorEvent.DELETED) {
      visible.set(false)
    }
  })

  return (
    <box cssClasses={['bar-widget']} visible={bind(visible)}>
      <image iconName={icon} />
      <label label={bind(capacity).as((p) => p.trim() + '%')} />
    </box>
  )
}



function SplitKb() {
  const device = btDevices
    .map(devices => devices.find(d => d.device.name == "Sofle"))
    .filter((d) => d != null)
    .shareReplay(1)

  const connected = device
    .flatMapLatest((d) => obs(d.device, 'connected'))
    .startWith(false)

  const battery = device
    .flatMapLatest(d => batteryStatusFor(d.device))
    .map(p => p.char0011.toString() + "/" + p.char0016)
    .startWith("/")
    .shareReplay(1)

  const icon = device.map(d => d.type.icon)

  return (
    <box cssClasses={['bar-widget']} visible={binding(connected)}>
      <image iconName={binding(icon)} />
      <label label={binding(battery)} />
    </box>
  )
}

function BtDeviceBattery(
  matcher: (c: BluetoothDeviceType) => Boolean,
) {
  const device = btDevices
    .map(devices => devices.find(d => matcher(d.type)))
    .filter((d) => d != null)
    .shareReplay(1)

  const connected = device
    .flatMapLatest((d) => obs(d.device, 'connected'))
    .startWith(false)

  const charge = device.flatMapLatest((d) => obs(d.device, 'batteryPercentage'))

  const icon = device.map(d => d.type.icon)

  return (
    <box cssClasses={['bar-widget']} visible={binding(connected)}>
      <image iconName={binding(icon)} />
      <label label={binding(charge).as((p) => (p * 100).toString() + '%')} />
    </box>
  )
}

