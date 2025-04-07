import { subprocess } from "astal";
import AstalBluetooth from "gi://AstalBluetooth?version=0.1";
import { Observable } from "rx";
import { launchScript } from "rxbinding";

type PeripheralBatteryStatus = {
  peripheral: number[]
}

type CentralBatteryStatus = {
  primary: number
}

type BatteryStatus = CentralBatteryStatus | CentralBatteryStatus & PeripheralBatteryStatus

type tmp = {
  char0011: number
  char0016: number
}

export function batteryStatusFor(device: AstalBluetooth.Device): Observable<tmp> {
  return launchScript(`scripts/ble_battery ${device.address}`).map(
    r => JSON.parse(r) as tmp
  )
}
