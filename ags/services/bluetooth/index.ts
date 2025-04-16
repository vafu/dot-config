export * from './devicetype'
import AstalBluetooth from 'gi://AstalBluetooth?version=0.1'
import {
  map,
  Observable,
  of,
  retry,
  shareReplay,
  switchMap,
} from 'rxjs'
import { fromConnectable } from 'rxbinding'
import { queryBatteryStats as batteryFromDbus } from './dbus-battery'
import { switchIfEmpty } from 'rxjs-etc/dist/esm/operators'

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
            return of<BatteryStatus>({ type: 'none' })
          }
        })
      )
    ),
    shareReplay(1)
  )
}

function handleConnected(
  device: AstalBluetooth.Device
): Observable<BatteryStatus> {
  return batteryFromDbus(device.address).pipe(
    switchIfEmpty(
      fromConnectable(device, 'batteryPercentage').pipe(
        map((v) => ({ type: 'single', primary: v * 100 }) as BatteryStatus)
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

export type BatteryStatus =
  | {
      type: 'single'
      primary: number
    }
  | {
      type: 'dual'
      primary: number
      secondary: number
    }
  | {
      type: 'none'
    }
