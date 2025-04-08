import AstalBluetooth from 'gi://AstalBluetooth?version=0.1'
import Gio from 'gi://Gio?version=2.0'
import GLib from 'gi://GLib?version=2.0'
import { Disposable, Observable } from 'rx'

const BATTERY_LEVEL_UUID = '00002a19-0000-1000-8000-00805f9b34fb'
const ADAPTER_PATH = '/org/bluez/hci0'
const BLUEZ_SERVICE = 'org.bluez'
const OBJECT_MANAGER_INTERFACE = 'org.freedesktop.DBus.ObjectManager'
const CHARACTERISTIC_INTERFACE = 'org.bluez.GattCharacteristic1'
const PROPERTY_INTERFACE = 'org.freedesktop.DBus.Properties'

function getDeviceProxy(
  dbusConnection: Gio.DBusConnection, // Takes the connection object
  name: string,
  objectPath: string,
  interfaceName: string
): Gio.DBusProxy {
  try {
    const proxy = Gio.DBusProxy.new_sync(
      dbusConnection,
      Gio.DBusProxyFlags.NONE,
      null,
      name,
      objectPath,
      interfaceName,
      null
    )

    if (!proxy) {
      throw new Error(
        `Failed to create proxy for ${objectPath} (returned null). Check BlueZ service and device path.`
      )
    }

    return proxy
  } catch (e) {
    const error = e as GLib.Error
    if (
      error.matches?.(Gio.DBusError, Gio.DBusError.SERVICE_UNKNOWN) ||
      error.matches?.(Gio.DBusError, Gio.DBusError.NAME_HAS_NO_OWNER)
    ) {
      throw new Error(
        `Cannot create proxy: BlueZ service (${name}) not found or not running. ${error.message}`
      )
    } else if (
      error.message &&
      error.message.includes(
        'GDBus.Error:org.freedesktop.DBus.Error.ObjectNotFound'
      )
    ) {
      throw new Error(
        `Cannot create proxy: Object path ${objectPath} not found. Is MAC address correct? Is device paired/known to BlueZ?`
      )
    } else {
      const errorMsg = e instanceof Error ? e.message : String(e)
      throw new Error(
        `Failed to create D-Bus proxy for ${objectPath} [${interfaceName}]: ${errorMsg}`
      )
    }
  }
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
      foundChars[path] = getDeviceProxy(
        bus,
        BLUEZ_SERVICE,
        path,
        CHARACTERISTIC_INTERFACE
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
  resultVariant.unref()
  parametersTuple.unref()
  if (resultVariant && resultVariant.n_children() == 1) {
    const valueVar = resultVariant.get_child_value(0)
    const bytes = valueVar.get_data_as_bytes().unref_to_data()
    valueVar.unref()
    if (bytes.length > 0) {
      return bytes[0]
    }
  }
  return -1
}
function batteryStatusForChar(
  bus: Gio.DBusConnection,
  path: string,
  proxy: Gio.DBusProxy
): Observable<number> {
  return Observable.create<number>((o) => {
    if (
      !getAndDeepUnpack<string[]>(proxy.get_cached_property('Flags')).includes('notify')
    ) {
      o.onCompleted()
      return
    }
    //
    const sub = bus.signal_subscribe(
      BLUEZ_SERVICE,
      PROPERTY_INTERFACE,
      'PropertiesChanged',
      path,
      CHARACTERISTIC_INTERFACE,
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
          if (l) o.onNext(l.get_data_as_bytes().unref_to_data()[0])
          l.unref()
        }
        params.unref()
      }
    )

    proxy.call_sync('StartNotify', null, Gio.DBusCallFlags.NONE, -1, null)
    return Disposable.create(() => {
      proxy.call_sync('StopNotify', null, Gio.DBusCallFlags.NONE, -1, null)
      bus.signal_unsubscribe(sub)
    })
  })
    .startWith(readBatteryLevel(proxy))
}

export function queryBatteryServiceFor(
  device: AstalBluetooth.Device
): Observable<number[]> {
  const address = device.address
  const addressPath = address.replace(/:/g, '_')
  const devicePath = `${ADAPTER_PATH}/dev_${addressPath}`

  const bus = Gio.DBus.system
  if (!bus) throw new Error('Failed to get system dbus: returned null')
  const deviceProxy = getDeviceProxy(
    bus,
    BLUEZ_SERVICE,
    devicePath,
    'org.bluez.Device1'
  )

  if (!deviceProxy.get_cached_property('Connected').unpack<boolean>())
    throw new Error(
      `${address} is not connected. Ensure device is connected prior querying`
    )

  // potentially must be done in a loop, but won't clutter now
  if (!deviceProxy.get_cached_property('ServicesResolved').unpack<boolean>())
    throw new Error(`service for ${address} is not resolved`)

  const battery_chars = findCharacteristics(bus, devicePath, BATTERY_LEVEL_UUID)

  return Observable.combineLatest(
    Object.keys(battery_chars)
      .sort()
      .map((path) => batteryStatusForChar(bus, path, battery_chars[path]))
  )
}

function getAndDeepUnpack<T>(variant: GLib.Variant): T {
  const v = variant.deepUnpack<T>()
  variant.unref()
  return v
}

function getAndUnref<T>(variant: GLib.Variant): T {
  const v = variant.unpack<T>()
  variant.unref()
  return v
}
