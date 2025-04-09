import Gio from 'gi://Gio?version=2.0'
import GLib from 'gi://GLib?version=2.0'
import { Disposable, Observable } from 'rx'

const BATTERY_LEVEL_UUID = '00002a19-0000-1000-8000-00805f9b34fb'
const ADAPTER_PATH = '/org/bluez/hci0'
const BLUEZ_SERVICE = 'org.bluez'
const OBJECT_MANAGER_INTERFACE = 'org.freedesktop.DBus.ObjectManager'
const CHARACTERISTIC_INTERFACE = 'org.bluez.GattCharacteristic1'
const DEVICE_INTERFACE = 'org.bluez.Device1'
const PROPERTY_INTERFACE = 'org.freedesktop.DBus.Properties'

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
  try {
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
  } catch (e) {
    return -1
  }
  return -1
}

function batteryStatusForChar(
  bus: Gio.DBusConnection,
  path: string,
  proxy: Gio.DBusProxy
): Observable<number> {
  return Observable.create<number>((o) => {
    o.onNext(readBatteryLevel(proxy))
    if (
      !proxy.get_cached_property('Flags').unpack<string[]>().includes('notify')
    ) {
      o.onCompleted()
      return
    }
    const sub = bus.signal_subscribe(
      BLUEZ_SERVICE,
      PROPERTY_INTERFACE,
      'PropertiesChanged',
      path,
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
        if (params.n_children() === 3) {
          const l = params.get_child_value(1).lookup_value('Value', null)
          if (l != null) o.onNext(l.get_data_as_bytes().get_data()[0])
        }
      }
    )

    proxy.call_sync('StartNotify', null, Gio.DBusCallFlags.NONE, -1, null)
    return Disposable.create(() => {
      proxy.call_sync('StopNotify', null, Gio.DBusCallFlags.NONE, -1, null)
      bus.signal_unsubscribe(sub)
    })
  })
}

// move to services
const deviceMap = new Map<string, Observable<number[]>>()
export function queryBatteryStats(address: string): Observable<number[]> {
  const cached = deviceMap.get(address)
  if (cached) return cached
  const n = query(address).shareReplay(1)
  deviceMap.set(address, n)
  return n
}

function query(address: string): Observable<number[]> {
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

  return retryUntilTrue(() => deviceProxy.get_cached_property('Connected').unpack<boolean>())
    .flatMapLatest(() => retryUntilTrue(() => deviceProxy.get_cached_property('ServicesResolved').unpack<boolean>()))
    .flatMapLatest(() => {
      const chars = findCharacteristics(bus, devicePath, BATTERY_LEVEL_UUID)
      if (Object.keys(chars).length == 0) return Observable.empty<number[]>()
      return Observable.combineLatest(
        Object.keys(chars)
          .sort()
          .map((path) => batteryStatusForChar(bus, path, chars[path]))
      )
    })
    .onErrorResumeNext(Observable.empty())
}

function retryUntilTrue(predicate: () => boolean): Observable<void> {
  return Observable.interval(1000)
    .startWith(0)
    .filter(() => predicate())
    .take(1)
    .map(() => { })
    .onErrorResumeNext(Observable.empty())
}
