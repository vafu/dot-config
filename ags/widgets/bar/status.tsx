import { Gio, readFile } from 'astal'
import { AstalIO, bind, exec, Variable } from 'astal'
import {
  DeviceClasses,
  MajorDeviceClass,
  parseCoD,
  ParsedDeviceClass,
} from 'commons'
import AstalBluetooth from 'gi://AstalBluetooth'
import { binding, obs } from 'rxbinding'

const CPU = Variable('0').poll(3000, () => exec('bash scripts/cpu.sh'))

const RAM = Variable('0').poll(3000, () => exec('bash scripts/ram.sh'))

const bt = AstalBluetooth.get_default()

console.log(
  bt.devices.map((d) => d.name + MajorDeviceClass[parseCoD(d.class)?.major])
)

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
      BtDeviceBattery(
        (c) => c.major === MajorDeviceClass.PERIPHERAL
        'input-keyboard-symbolic'
      ),
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

function BtDeviceBattery(
  matcher: (c: ParsedDeviceClass) => Boolean,
  icon: string
) {
  const device = obs(bt, 'devices')
    .map((d) => d.find((dev) => matcher(parseCoD(dev.class))))
    .filter((d) => d != null)
    .shareReplay(1)
  const connected = device
    .flatMapLatest((d) => obs(d, 'connected'))
    .startWith(false)
  const charge = device.flatMapLatest((d) => obs(d, 'batteryPercentage'))

  return (
    <box cssClasses={['bar-widget']} visible={binding(connected)}>
      <image iconName={icon} />
      <label label={binding(charge).as((p) => (p * 100).toString() + '%')} />
    </box>
  )
}
