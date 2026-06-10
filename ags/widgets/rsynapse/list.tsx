import { Accessor } from 'gnim'
import Gio from 'gi://Gio?version=2.0'
import App from 'ags/gtk4/app'
import { Astal, Gdk, Gtk } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'
import { binding, subscribeTo } from 'rxbinding'
import { getRsynapseService, RsynapseResult } from 'services/rsynapse'
import rsynapseUi, { RsynapseSearch } from 'widgets/rsynapse'

const rsynapse = getRsynapseService()
const items = new Gio.ListStore({ item_type: RsynapseResult.$gtype })
export const selection = new Gtk.SingleSelection({ model: items })

export function Rsynapse(monitor: Accessor<Gdk.Monitor>) {
  selection.set_autoselect(true)

  const factory = new Gtk.SignalListItemFactory()

  factory.connect('setup', (self, listItem: Gtk.ListItem) => {
    const row = new Adw.ActionRow()
    listItem.set_child(row)
  })

  factory.connect('bind', (self, listItem: Gtk.ListItem) => {
    const ro = listItem.get_item() as RsynapseResult
    const row = listItem.get_child() as Adw.ActionRow

    row.set_title(ro.title)
    row.set_subtitle(ro.description)
    row.set_icon_name(ro.icon)
  })

  const listView = new Gtk.ListView({
    model: selection,
    factory: factory,
    focusable: false,
    cssClasses: ['navigation-sidebar', 'rsynapse-items'],
    valign: Gtk.Align.END,
    vexpand: false,
  })

  listView.connect('activate', (self, position) => {
    const item = selection.get_item(position) as RsynapseResult
    rsynapse.execute(item)
  })

  subscribeTo(listView, rsynapse.results, i => {
    items.remove_all()
    i.forEach(entry => items.append(entry))
    listView.set_visible(i.length > 0)
  })

  return (
    <window
      gdkmonitor={monitor}
      visible={binding(rsynapseUi.active, false)}
      application={App}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.NORMAL}
      name={'rsynapse'}
      keymode={
        Astal.Keymode.ON_DEMAND
        // bindAs(rsynapseUi.active, a =>
        // a ? Astal.Keymode.EXCLUSIVE : Astal.Keymode.NONE,
      }
      cssClasses={['rsynapse-window']}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM}
    >
      <box
        orientation={Gtk.Orientation.VERTICAL}
        valign={Gtk.Align.END}
        css_classes={['rsynapse']}
      >
        {listView}
        <RsynapseSearch revealed={rsynapseUi.active} />
      </box>
    </window>
  )
}
