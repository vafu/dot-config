import { Binding, Gio, GLib, GObject } from 'astal'
import { App, Astal, Gdk, Gtk } from 'astal/gtk4'
import Adw from 'gi://Adw?version=1'
import { binding } from 'rxbinding'
import { getRsynapseService, RsynapseResult } from 'services/rsynapse'
import { ActionRow, ListBox } from 'widgets/adw'
import rsynapseUi from 'widgets/rsynapse'

const rsynapse = getRsynapseService()
const items = new Gio.ListStore({ item_type: RsynapseResult.$gtype })
export const selection = new Gtk.SingleSelection({ model: items })

export function Rsynapse(monitor: Binding<Gdk.Monitor>) {
  selection.set_autoselect(true)

  const factory = new Gtk.SignalListItemFactory()

  factory.connect('setup', (self, listItem: Gtk.ListItem) => {
    const row = <ActionRow />
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
  })

  listView.connect('activate', (self, position) => {
    const item = selection.get_item(position) as RsynapseResult
    item.launch()
  })

  const scrolledwindow = (
    <Gtk.ScrolledWindow
      vscrollbarPolicy={Gtk.PolicyType.NEVER}
      name="scroll"
      propagate_natural_width={true}
      propagate_natural_height={true}
      maxContentHeight={10}
      css_classes={['rsynapse-items']}
    >
      {listView}
    </Gtk.ScrolledWindow>
  )

  const revealer = new Gtk.Revealer({
    child: scrolledwindow,
    revealChild: true,
    transitionType: Gtk.RevealerTransitionType.SLIDE_DOWN,
  })

  rsynapse.results.subscribe(i => {
    items.remove_all()
    i.forEach(entry => items.append(entry))
    revealer.set_reveal_child(i.length > 0)
  })

  return (
    <window
      gdkmonitor={monitor}
      visible={binding(rsynapseUi.active)}
      application={App}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.NORMAL}
      name={'rsynapse'}
      keymode={Astal.Keymode.NONE}
      cssClasses={['rsynapse']}
      valign={Gtk.Align.CENTER}
      anchor={Astal.WindowAnchor.TOP}
      hexpand={true}
    >
      {revealer}
    </window>
  )
}
