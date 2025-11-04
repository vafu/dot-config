import { GObject } from "astal"
import { Gtk } from "astal/gtk4"
import Tray from "gi://AstalTray"

export function SysTray() {
  const tray = Tray.get_default()

  const traybox = new Gtk.Box()
  const trayItems = new Map<string, Gtk.MenuButton>()
  const itemAdded = tray.connect('item-added', (_, id) => {
    const item = tray.get_item(id)
    if (item.id == null) return
    const popover = Gtk.PopoverMenu.new_from_model(item.menuModel)
    const icon = new Gtk.Image()
    const button = new Gtk.MenuButton({ popover, child: icon, cssClasses: ["flat", "circular",] })

    item.bind_property('gicon', icon, 'gicon', GObject.BindingFlags.SYNC_CREATE)
    popover.insert_action_group('dbusmenu', item.actionGroup)
    item.connect("notify::action-group", () => {
      popover.insert_action_group("dbusmenu", item.action_group)
    })

    trayItems.set(id, button)
    traybox.append(button)
  })

  const itemRemoved = tray.connect("item-removed", (_, id) => {
    const button = trayItems.get(id)
    if (button) {
      traybox.remove(button)
      button.run_dispose()
      trayItems.delete(id)
    }
  })

  traybox.connect('destroy', () => {
    tray.disconnect(itemAdded)
    tray.disconnect(itemRemoved)
  })

  return traybox
}
