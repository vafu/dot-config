#!/usr/bin/env python3
import sys
import time
import dbus
import dbus.service
import dbus.mainloop.glib
from gi.repository import GLib

AGENT_IFACE = 'org.bluez.Agent1'
AGENT_MANAGER_IFACE = 'org.bluez.AgentManager1'
AGENT_PATH = "/test/agent"

BLUEZ_SERVICE = 'org.bluez'
ADAPTER_IFACE = 'org.bluez.Adapter1'
DEVICE_IFACE = 'org.bluez.Device1'
PROPERTIES_IFACE = 'org.freedesktop.DBus.Properties'

TARGET_ADDRESS = None
loop = None
device_obj = None
adapter_path = None
bus = None


def find_adapter():
    obj_manager = dbus.Interface(bus.get_object(
        BLUEZ_SERVICE, '/'), 'org.freedesktop.DBus.ObjectManager')
    for path, interfaces in obj_manager.GetManagedObjects().items():
        if ADAPTER_IFACE in interfaces:
            print(f"Found adapter at {path}")
            return path
    return None


def interfaces_added(path, interfaces):
    global device_obj
    if DEVICE_IFACE not in interfaces:
        return

    device_properties = interfaces[DEVICE_IFACE]

    if device_properties['Address'] == TARGET_ADDRESS:
        print(f"✅ Found target device at {path}!")

        adapter_iface = dbus.Interface(bus.get_object(
            BLUEZ_SERVICE, adapter_path), ADAPTER_IFACE)
        adapter_iface.StopDiscovery()

        device_obj = bus.get_object(BLUEZ_SERVICE, path)
        device_props_iface = dbus.Interface(device_obj, PROPERTIES_IFACE)

        time.sleep(2)

        print("Trusting device...")
        device_props_iface.Set(DEVICE_IFACE, "Trusted", True)

        print("Pairing...")
        device_iface = dbus.Interface(device_obj, DEVICE_IFACE)
        device_iface.Pair(reply_handler=lambda: None,
                          error_handler=print_error)


def properties_changed(iface, changed_props, invalidated_props, path=None):
    if iface != DEVICE_IFACE or not device_obj:
        return

    device_props_iface = dbus.Interface(device_obj, PROPERTIES_IFACE)
    device_address = device_props_iface.Get(DEVICE_IFACE, "Address")

    if device_address != TARGET_ADDRESS:
        return

    elif 'Paired' in changed_props and changed_props['Paired']:
        print("Paired successfully. Connecting...")
        device_iface = dbus.Interface(device_obj, DEVICE_IFACE)
        device_iface.Connect(reply_handler=lambda: None,
                             error_handler=print_error)
        loop.quit()


def print_error(error):
    print(f"D-Bus Error: {error}")


def main():
    global bus, loop, adapter_path, TARGET_ADDRESS

    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <device_address>", file=sys.stderr)
        sys.exit(1)
    TARGET_ADDRESS = sys.argv[1].upper()

    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
    bus = dbus.SystemBus()

    agent_manager = dbus.Interface(bus.get_object(
        BLUEZ_SERVICE, "/org/bluez"), AGENT_MANAGER_IFACE)
    agent_manager.RegisterAgent(AGENT_PATH, "NoInputNoOutput")
    agent_manager.RequestDefaultAgent(AGENT_PATH)
    print("Pairing agent registered.")

    adapter_path = find_adapter()
    if not adapter_path:
        print("Error: Could not find a Bluetooth adapter.", file=sys.stderr)
        sys.exit(1)

    adapter_obj = bus.get_object(BLUEZ_SERVICE, adapter_path)
    adapter_iface = dbus.Interface(adapter_obj, ADAPTER_IFACE)
    adapter_props_iface = dbus.Interface(adapter_obj, PROPERTIES_IFACE)

    try:
        device_path = f"{adapter_path}/dev_{TARGET_ADDRESS.replace(':', '_')}"
        print(f"Attempting to remove device {device_path}...")
        adapter_iface.RemoveDevice(device_path)
        print("Device removed successfully.")
    except dbus.exceptions.DBusException as e:
        if "DoesNotExist" in e.get_dbus_name():
            print("Device was not in the list, skipping removal.")
        else:
            print(f"Error removing device: {e.get_dbus_name()}")

    powered = adapter_props_iface.Get(ADAPTER_IFACE, "Powered")
    if powered:
        print("Performing Bluetooth adapter power cycle...")
        adapter_props_iface.Set(ADAPTER_IFACE, "Powered", False)
        time.sleep(1)
    adapter_props_iface.Set(ADAPTER_IFACE, "Powered", True)
    time.sleep(1)
    print("Adapter ready.")

    bus.add_signal_receiver(
        interfaces_added, dbus_interface="org.freedesktop.DBus.ObjectManager", signal_name="InterfacesAdded")
    bus.add_signal_receiver(properties_changed, dbus_interface=PROPERTIES_IFACE,
                            signal_name="PropertiesChanged", arg0=DEVICE_IFACE, path_keyword="path")

    try:
        print(f"Scanning for {TARGET_ADDRESS}...")
        adapter_iface.StartDiscovery()
        loop = GLib.MainLoop()
        loop.run()
    except KeyboardInterrupt:
        print("\nOperation cancelled.")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        agent_manager.UnregisterAgent(AGENT_PATH)
        print("Agent unregistered.")


if __name__ == '__main__':
    main()
