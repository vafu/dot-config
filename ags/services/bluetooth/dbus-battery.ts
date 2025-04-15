import { onErrorEmpty } from 'commons/rx'
import Gio from 'gi://Gio?version=2.0'
import GLib from 'gi://GLib?version=2.0'
import {
  combineLatestAll,
  defer,
  EMPTY,
  map,
  Observable,
  of,
  OperatorFunction,
  retry,
  shareReplay,
  switchMap,
} from 'rxjs'
import { BatteryStatus } from '.'
import { fromArrayLike } from 'rxjs/internal/observable/innerFrom'
import { startWithDeferred, switchIfEmpty } from 'rxjs-etc/dist/esm/operators'

// move to services
const deviceMap = new Map<string, Observable<BatteryStatus>>()
export function queryBatteryStats(address: string): Observable<BatteryStatus> {
  const cached = deviceMap.get(address)
  if (cached) return cached
  const n = defer(() => queryUpower(address)).pipe(
    switchIfEmpty(defer(() => queryBluez(address))),
    shareReplay(1)
  )
  deviceMap.set(address, n)
  return n
}

const UPOWER_PATH = '/org/freedesktop/UPower/devices/battery_hid'
const UPOWER_SERVICE = 'org.freedesktop.UPower'
const UPOWER_DEVICE_INTERFACE = `${UPOWER_SERVICE}.Device`

function queryUpower(address: string): Observable<BatteryStatus> {
  const address_path = address.replace(/:/g, 'o')
  const devicePath = `${UPOWER_PATH}_${address_path.toLowerCase()}_battery`

  const bus = Gio.DBus.system
  if (!bus) throw new Error('Failed to get system dbus: returned null')

  const deviceProxy = Gio.DBusProxy.new_sync(
    bus,
    Gio.DBusProxyFlags.NONE,
    null,
    UPOWER_SERVICE,
    devicePath,
    UPOWER_DEVICE_INTERFACE,
    null
  )

  return fromPropertyNotifications({
    bus: bus,
    service: UPOWER_SERVICE,
    path: devicePath,
    prop: 'Percentage',
  }).pipe(
    startWithDeferred(() =>
      deviceProxy.get_cached_property('Percentage').unpack<number>()
    ),
    map((v) => ({ type: 'single', primary: v } as BatteryStatus)),
    onErrorEmpty()
  )
}

const BATTERY_LEVEL_UUID = '00002a19-0000-1000-8000-00805f9b34fb'
const ADAPTER_PATH = '/org/bluez/hci0'
const BLUEZ_SERVICE = 'org.bluez'
const OBJECT_MANAGER_INTERFACE = 'org.freedesktop.DBus.ObjectManager'
const CHARACTERISTIC_INTERFACE = 'org.bluez.GattCharacteristic1'
const DEVICE_INTERFACE = 'org.bluez.Device1'

function queryBluez(address: string): Observable<BatteryStatus> {
  const addressPath = address.replace(/:/g, '_')
  const devicePath = `${ADAPTER_PATH}/dev_${addressPath}`

  const bus = Gio.DBus.system
  if (!bus) throw new Error('Failed to get system dbus: returned null')
  const deviceProxy = Gio.DBusProxy.new_sync(
    bus,
    Gio.DBusProxyFlags.NONE,
    null,
    BLUEZ_SERVICE,
    devicePath,
    DEVICE_INTERFACE,
    null
  )

  return retryUntilTrue(() =>
    deviceProxy.get_cached_property('Connected').unpack<boolean>()
  ).pipe(
    switchMap(() =>
      retryUntilTrue(() =>
        deviceProxy.get_cached_property('ServicesResolved').unpack<boolean>()
      )
    ),
    switchMap(() => {
      const chars = findCharacteristics(bus, devicePath, BATTERY_LEVEL_UUID)
      if (Object.keys(chars).length == 0) {
        return EMPTY
      } else {
        return fromArrayLike(Object.keys(chars).sort()).pipe(
          map((path) => {
            const proxy = chars[path]
            return fromPropertyNotifications({
              bus: bus,
              service: BLUEZ_SERVICE,
              path: path,
              prop: 'Value',
              callbacks: {
                setup: () =>
                  proxy.call_sync(
                    'StartNotify',
                    null,
                    Gio.DBusCallFlags.NONE,
                    -1,
                    null
                  ),
                teardown: () =>
                  proxy.call_sync(
                    'StopNotify',
                    null,
                    Gio.DBusCallFlags.NONE,
                    -1,
                    null
                  ),
              },
            }).pipe(startWithDeferred(() => readBatteryLevel(proxy)))
          }),
          combineLatestAll(),
          mapAsBatteryStatus()
        )
      }
    })
  )
}

function findCharacteristics(
  bus: Gio.DBusConnection,
  devicePath: string,
  targetUUID: String
): { [path: string]: Gio.DBusProxy } {
  const foundChars: { [path: string]: Gio.DBusProxy } = {}
  const _uuid = targetUUID.toLowerCase()
  const proxy = Gio.DBusProxy.new_sync(
    bus,
    Gio.DBusProxyFlags.NONE,
    null,
    BLUEZ_SERVICE,
    '/',
    OBJECT_MANAGER_INTERFACE,
    null
  )
  const managedObjsVariant = proxy.call_sync(
    'GetManagedObjects',
    null,
    Gio.DBusCallFlags.NONE,
    -1,
    null
  )

  if (!managedObjsVariant)
    throw new Error('GetManagedObjects call returned null variant.')

  const managedObjs = managedObjsVariant.deepUnpack()[0] as {
    [path: string]: { [iface: string]: { [prop: string]: any } }
  }

  for (const [path, ifaces] of Object.entries(managedObjs)) {
    if (!path.startsWith(devicePath)) continue
    const charIfaceData = ifaces[CHARACTERISTIC_INTERFACE]
    if (!charIfaceData) continue
    const uuid: string = (charIfaceData['UUID'] as GLib.Variant).unpack()

    if (uuid && uuid.toLowerCase() === _uuid) {
      foundChars[path] = Gio.DBusProxy.new_sync(
        bus,
        Gio.DBusProxyFlags.NONE,
        null,
        BLUEZ_SERVICE,
        path,
        CHARACTERISTIC_INTERFACE,
        null
      )
    }
  }
  return foundChars
}

function readBatteryLevel(proxy: Gio.DBusProxy): number {
  const parametersTuple = new GLib.Variant('(a{sv})', [{}])
  const resultVariant = proxy.call_sync(
    'ReadValue',
    parametersTuple,
    Gio.DBusCallFlags.NONE,
    -1,
    null
  )
  if (resultVariant && resultVariant.n_children() == 1) {
    const valueVar = resultVariant.get_child_value(0)
    const bytes = valueVar.get_data_as_bytes().get_data()
    if (bytes.length > 0) {
      return bytes[0]
    }
  }
  return -1
}

const PROPERTY_INTERFACE = 'org.freedesktop.DBus.Properties'

function fromPropertyNotifications(opts: {
  bus: Gio.DBusConnection
  service: string
  path: string
  // maybe change to vararg and do better api when listening to many props
  prop: string
  callbacks?: Partial<{ setup: () => void; teardown: () => void }>
}): Observable<number> {
  return new Observable<number>((o) => {
    const sub = opts.bus.signal_subscribe(
      opts.service,
      PROPERTY_INTERFACE,
      'PropertiesChanged',
      opts.path,
      null,
      Gio.DBusSignalFlags.NONE,
      (
        _conn: Gio.DBusConnection,
        _sender: string,
        _objPath: string,
        _ifaceName: string,
        _sigName: string,
        params: GLib.Variant
      ) => {
        if (params == null) return
        if (params.n_children() === 3) {
          const l = params.get_child_value(1).lookup_value(opts.prop, null)
          if (l != null) o.next(l.get_data_as_bytes().get_data()[0])
        }
      }
    )

    opts.callbacks?.setup?.()
    return () => {
      opts.callbacks?.teardown?.()
      opts.bus.signal_unsubscribe(sub)
    }
  })
}

function retryUntilTrue(predicate: () => boolean): Observable<boolean> {
  if (predicate()) return of(true)

  return new Observable<boolean>((o) => {
    if (predicate()) {
      o.next(true)
    } else {
      o.error(Error('predicate is false'))
    }
  }).pipe(
    retry({
      count: 2,
      delay: 1000,
    }),
    onErrorEmpty()
  )
}

function mapAsBatteryStatus(): OperatorFunction<number[], BatteryStatus> {
  return map<number[], BatteryStatus>((values) => {
    switch (true) {
      case values.length == 1:
        return { type: 'single', primary: values[0] }
      case values.length == 2:
        return { type: 'dual', primary: values[0], secondary: values[1] }
      default:
        return { type: 'none' }
    }
  })
}
