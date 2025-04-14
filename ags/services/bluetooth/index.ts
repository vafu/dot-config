export * from './devicetype'
import AstalBluetooth from 'gi://AstalBluetooth?version=0.1'
import {
  delay,
  map,
  Observable,
  of,
  retry,
  retryWhen,
  switchMap,
  tap,
} from 'rxjs'
import { fromConnectable, fromFile } from 'rxbinding'
import { queryBatteryStats as batteryFromDbus } from './dbus-battery'
import { switchIfEmpty } from 'rxjs-etc/dist/esm/operators'
import { type } from 'astal/gtk4/astalify'

export function batteryStatusFor(
  device: Observable<AstalBluetooth.Device>
): Observable<BatteryStatus> {
  return device.pipe(
    switchMap((d) =>
      fromConnectable(d, 'connected').pipe(
        switchMap((connected) => {
          if (connected) {
            return handleConnected(d)
          } else {
            return of({ type: 'none' })
          }
        })
      )
    )
  )
}

function handleConnected(
  device: AstalBluetooth.Device
): Observable<BatteryStatus> {
  return batteryFromDbus(device.address).pipe(
    switchIfEmpty(
      fromConnectable(device, 'batteryPercentage').pipe(
        map((v) => ({ type: 'single', primary: v * 100 }))
      )
    ),
    retry({
      count: 10,
      delay: 1000,
    })
  )
}

export type SingleBattery = { primary: number }
export type DualBattery = SingleBattery & { secondary: number }
export type NoBattery = {}

export type BatteryStatus = {
  type: "single"
  primary: number
} | {
  type: "dual"
  primary: number
  secondary: number
} | {
  type: "none"
}
