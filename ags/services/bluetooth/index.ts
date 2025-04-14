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
import { SignalMethods } from '@girs/gjs'

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
            return of({})
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
        map((v) => ({ primary: v }))
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

export type BatteryStatus = SingleBattery | DualBattery | NoBattery

export function hasBattery(
  status: BatteryStatus
): status is SingleBattery | DualBattery {
  return (<SingleBattery>status).primary !== undefined
}

export function hasDualBattery(status: BatteryStatus): status is DualBattery {
  return (<DualBattery>status).secondary !== undefined
}
