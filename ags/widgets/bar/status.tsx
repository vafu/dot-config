import { bind, exec, Gio, GLib, GObject, Variable } from 'astal'
import {
  batteryStatusFor,
  BluetoothDeviceType,
  BluetoothDeviceTypes,
  getDeviceType,
} from 'services/bluetooth'
import AstalBluetooth from 'gi://AstalBluetooth'
import { bindAs, binding, fromConnectable } from 'rxbinding'
import {
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs'
import { LevelIndicator, RenderStyle } from 'widgets/circularstatus'
import { MaterialIcon } from 'widgets/materialicon'
import { PanelButton } from './panel-buttons'
import { Gtk } from 'astal/gtk4'
import { Label } from 'astal/gtk4/widget'
import { ActionRow, ListBox } from 'widgets/adw'
import Adw from 'gi://Adw?version=1'
import { fromPromise } from 'rxjs/internal/observable/innerFrom'

const CPU = Variable('0').poll(3000, () => exec('bash scripts/cpu.sh'))

const RAM = Variable('0').poll(3000, () => exec('bash scripts/ram.sh'))

const btDevices = fromConnectable(AstalBluetooth.get_default(), 'devices')

const stages = [
  { level: 35, class: 'warn' },
  { level: 50, class: 'high' },
  { level: 80, class: 'danger' },
  { level: 90, class: 'critical' },
]

const STYLE: Partial<RenderStyle> = {
  thickness: 2,
}

const ARC_STYLE: Partial<RenderStyle> = {
  style: 'arc',
  radius: 16,
  ...STYLE,
}

export const Status = () => (
  <box>
    <box cssClasses={['bar-widget']}>
      <LevelIndicator
        cssClasses={['sys']}
        stages={stages}
        style={ARC_STYLE}
        level={CPU().as((v) => parseInt(v))}
      />
      <MaterialIcon icon="memory" cssClasses={["p24"]} />
      <LevelIndicator
        cssClasses={['sys']}
        stages={stages}
        style={{ ...ARC_STYLE, curveDirection: 'start' }}
        level={RAM().as((v) => parseInt(v))}
      />
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
  const devices = btDevices.pipe(
    map((devices) =>
      devices.sort((a, b) => Number(b.connected) - Number(a.connected)).filter(d => matcher(getDeviceType(d)))
    ),
    filter((d) => d != null),
    shareReplay(1)
  )
  const device = devices.pipe(map(a => a.find(d => matcher(getDeviceType(d)))), shareReplay(1))

  const connected = device.pipe(
    switchMap((d) => fromConnectable(d, 'connected')),
    startWith(false)
  )

  const charge = batteryStatusFor(device)
  const iconname = device.pipe(map((d) => getDeviceType(d).icon))
  const stages = [{ level: 5, class: 'ok' }]
  const icon = (
    <MaterialIcon
      icon={binding(iconname)}
      tinted={bindAs(connected, (c) => !c)}
    />
  )
  const indicator = (
    <box
      tooltipText={bindAs(device, (d) => d.name)}
      halign={Gtk.Align.CENTER}
      cssClasses={["bar-widget"]}
    >
      {binding(
        charge.pipe(
          map((v) => v.type),
          distinctUntilChanged(),
          map((v) => {
            switch (v) {
              case 'single':
                const battery = charge.pipe(
                  filter((v) => v.type === 'single'),
                  map((v) => v.primary)
                )
                return [
                  icon,
                  <LevelIndicator
                    cssClasses={['battery']}
                    stages={stages}
                    style={{ style: 'line', ...STYLE }}
                    level={binding(battery)}
                    visible={binding(connected)}
                  />,
                ]

              case 'dual':
                const left = charge.pipe(
                  filter((v) => v.type === 'dual'),
                  map((v) => v.primary)
                )
                const right = charge.pipe(
                  filter((v) => v.type === 'dual'),
                  map((v) => v.secondary)
                )

                return [
                  <LevelIndicator
                    cssClasses={['battery']}
                    style={ARC_STYLE}
                    level={binding(left)}
                    stages={stages}
                    visible={binding(connected)}
                  />,
                  icon,
                  <LevelIndicator
                    cssClasses={['battery']}
                    style={{ ...ARC_STYLE, curveDirection: 'start' }}
                    level={binding(right)}
                    stages={stages}
                    visible={binding(connected)}
                  />,
                ]
              case 'none':
                return [icon]
            }
          })
        )
      )}
    </box>
  )
  const popover = new Gtk.Popover({
    cssClasses: ["menu"],
    child: <ListBox setup={w => w.connect("row-activated", (_, b) => AstalBluetooth.get_default().devices.find(d => d.address == b.name).connect_device(null))
    }>
      {binding(devices.pipe(map(a => a.map(d => <ActionRow title={d.name} activatable={true} name={d.address} />))))}
    </ListBox >
  })

  const button = new Gtk.MenuButton({ popover: popover, child: indicator, cssClasses: ["flat", "circular"] })
  return button
}
