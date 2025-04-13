export * from './devicetype'
import AstalBluetooth from 'gi://AstalBluetooth?version=0.1'
import { map, Observable, of, switchMap } from 'rxjs'
import { fromConnectable, fromFile } from 'rxbinding'
import { queryBatteryStats as batteryFromDbus } from './dbus-battery'
import { switchIfEmpty } from 'rxjs-etc/dist/esm/operators'

export function batteryStatusFor(
  device: Observable<AstalBluetooth.Device>
): Observable<number[]> {
  return device.pipe(
    switchMap((d) =>
      fromConnectable(d, 'connected').pipe(
        switchMap((connected) => {
          if (connected) {
            return handleConnected(d)
          } else {
            return of([] as number[])
          }
        })
      )
    )
  )
}

function handleConnected(device: AstalBluetooth.Device): Observable<number[]> {
  return batteryFromDbus(device.address).pipe(
    switchIfEmpty(
      fromFile(
        `/sys/class/power_supply/hid-${device.address.toLowerCase()}-battery/capacity`
      ).pipe(map((v) => [parseInt(v)]))
    ),
    switchIfEmpty(
      fromConnectable(device, 'batteryPercentage').pipe(map((v) => [v]))
    )
  )
}
