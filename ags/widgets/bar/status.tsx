import { bind, exec, Variable } from 'astal'
import AstalBluetooth from 'gi://AstalBluetooth'

const CPU = Variable('0').poll(3000, () => exec('bash scripts/cpu.sh'))

const RAM = Variable('0').poll(3000, () => exec('bash scripts/ram.sh'))

const keeb = AstalBluetooth.get_default()
  .get_devices()
  .find((d) => d.name == 'Sofle')

console.log(keeb.batteryPercentage)

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

    <box cssClasses={['bar-widget']}>
      <image iconName="preferences-desktop-keyboard" />
      <label
        label={bind(keeb, 'batteryPercentage').as(
          (p) => (p * 100).toString() + '%'
        )}
      />
    </box>
  </box>
)
