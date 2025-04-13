import AstalBluetooth from 'gi://AstalBluetooth?version=0.1'
import { Observable, of, switchMap } from 'rxjs'
import { fromConnectable } from 'rxbinding'
import { queryBatteryStats } from './glib-battery'
import { logNext } from 'commons/rx'

export function batteryStatusFor(
  device: Observable<AstalBluetooth.Device>
): Observable<number[]> {
  return device.pipe(
    switchMap((d) =>
      fromConnectable(d, 'connected').pipe(
        switchMap((connected) => {
          if (connected) {
            return queryBatteryStats(d.address)
          } else {
            return of([] as number[])
          }
        })
      )
    )
  )
}

function handleConnected() {}
