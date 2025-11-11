import { bind } from 'astal'
import {
  batteryStatusFor,
  BluetoothDeviceType,
  BluetoothDeviceTypes,
  getDeviceType,
} from 'services/bluetooth'
import AstalBluetooth from 'gi://AstalBluetooth'
import { bindAs, binding, fromConnectable } from 'rxbinding'
import {
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
  throttleTime,
} from 'rxjs'
import { MaterialIcon } from 'widgets/materialicon'
import { Gtk } from 'astal/gtk4'
import { ActionRow, ListBox } from 'widgets/adw'
import {
  DualIndicator,
  IconIndicator,
  IconIndicatorProps,
  PanelButtonGroup,
  SingleIndicator,
} from './panel-widgets'

const btDevices = fromConnectable(AstalBluetooth.get_default(), 'devices').pipe(
  debounceTime(200),
  shareReplay(1),
)

function BtDeviceBattery(props: {
  matcher: (c: BluetoothDeviceType) => Boolean
}) {
  const devices = btDevices.pipe(
    throttleTime(5000),
    map(devices =>
      devices
        .sort((a, b) => Number(b.connected) - Number(a.connected))
        .map(d => ({ device: d, type: getDeviceType(d) }))
        .filter(d => props.matcher(d.type)),
    ),
    filter(d => d != null && d.length > 0),
    shareReplay(1),
  )
  const device = devices.pipe(
    map(a => a[0]),
    shareReplay(1),
  )

  const connected = device.pipe(
    switchMap(d => fromConnectable(d.device, 'connected')),
    startWith(false),
  )

  const charge = batteryStatusFor(device.pipe(map(a => a.device)))
  const levelVisible = bindAs(connected, c => c)

  const iconIndicatorProps: IconIndicatorProps = {
    icon: binding(device.pipe(map(d => d.type.icon))),
    tinted: bindAs(connected, c => !c),
  }
  const stages = [{ level: 5, class: 'ok' }]
  const indicator = (
    <box
      tooltipText={bindAs(device, d => d.device.name)}
      halign={Gtk.Align.CENTER}
    >
      {binding(
        charge.pipe(
          map(v => v.type),
          distinctUntilChanged(),
          map(v => {
            switch (v) {
              case 'single':
                const battery = charge.pipe(
                  filter(v => v.type === 'single'),
                  map(v => v.primary),
                )
                return [
                  SingleIndicator({
                    levelVisible: levelVisible,
                    level: binding(battery),
                    stages: stages,
                    ...iconIndicatorProps,
                  }),
                ]

              case 'dual':
                const left = charge.pipe(
                  filter(v => v.type === 'dual'),
                  map(v => v.primary),
                )
                const right = charge.pipe(
                  filter(v => v.type === 'dual'),
                  map(v => v.secondary),
                )

                return [
                  DualIndicator({
                    left: binding(left),
                    right: binding(right),
                    levelsVisible: levelVisible,
                    stages: stages,
                    ...iconIndicatorProps,
                  }),
                ]

              case 'none':
                return [IconIndicator(iconIndicatorProps)]
            }
          }),
        ),
      )}
    </box>
  )

  const devicesForView = devices.pipe(
    distinctUntilChanged(
      (a, b) =>
        a.map(d => d.device.address + d.device.connected) ==
        b.map(d => d.device.address + d.device.connected),
    ),
    map(a =>
      a.map(d => (
        <ActionRow
          title={bind(d.device, 'name')}
          activatable={true}
          name={d.device.address}
          subtitle={binding(
            fromConnectable(d.device, 'connected').pipe(
              switchMap(connected =>
                connected
                  ? of('Connected')
                  : fromConnectable(d.device, 'connecting').pipe(
                      map(connecting => (connecting ? 'Connecting...' : '')),
                    ),
              ),
            ),
          )}
        />
      )),
    ),
  )
  const popover = new Gtk.Popover({
    cssClasses: ['menu'],
    child: (
      <ListBox
        setup={w =>
          w.connect('row-activated', (_, b) => {
            const d = AstalBluetooth.get_default().devices.find(
              d => d.address == b.name,
            )
            if (d.connected) {
              d.disconnect_device(null)
            } else {
              d.connect_device(null)
            }
          })
        }
      >
        {binding(devicesForView)}
      </ListBox>
    ),
  })

  return <menubutton popover={popover}>{indicator}</menubutton>
}

type BtStatus =
  | { icon: 'bluetooth_disabled' }
  | { icon: 'bluetooth' }
  | { icon: 'bluetooth_searching'; connected: number }
  | { icon: 'bluetooth_connected'; connected: number }

export const BluetoothStatus = () => {
  const btservice = AstalBluetooth.get_default()

  const btStatus: Observable<BtStatus> = fromConnectable(
    btservice,
    'is_powered',
  ).pipe(
    switchMap(powered =>
      powered
        ? fromConnectable(btservice, 'adapter').pipe(
            switchMap(adapter =>
              combineLatest(
                fromConnectable(adapter, 'discovering'),
                fromConnectable(btservice, 'is_connected'),
              ),
            ),
            map(([discovering, connected]) =>
              discovering
                ? { icon: 'bluetooth_searching', connected: 0 }
                : connected
                  ? { icon: 'bluetooth_connected', connected: 1 }
                  : { icon: 'bluetooth' },
            ),
          )
        : of({ icon: 'bluetooth_disabled' }),
    ),
  )

  return (
    <PanelButtonGroup>
      <button onClicked={() => btservice.toggle()}>
        <overlay>
          <MaterialIcon icon={bindAs(btStatus, s => s.icon)} />
          <label
            type="overlay"
            cssClasses={['bt-count']}
            label={bindAs(btStatus, s => {
              const connected: number = s.connected
              return !!connected ? connected.toString() : ''
            })}
          />
        </overlay>
      </button>

      <BtDeviceBattery
        matcher={t => t === BluetoothDeviceTypes.INPUT_KEYBOARD}
      />

      <BtDeviceBattery
        matcher={t =>
          [
            BluetoothDeviceTypes.AUDIO_HEADPHONES,
            BluetoothDeviceTypes.AUDIO_HEADSET,
            BluetoothDeviceTypes.AUDIO_CARD,
          ].includes(t)
        }
      />

      <BtDeviceBattery
        matcher={t =>
          [
            BluetoothDeviceTypes.INPUT_TABLET,
            BluetoothDeviceTypes.INPUT_MOUSE,
          ].includes(t)
        }
      />
    </PanelButtonGroup>
  )
}
