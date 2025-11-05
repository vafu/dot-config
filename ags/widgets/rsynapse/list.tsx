import { bind, Binding, Gio, GLib, GObject } from 'astal'
import { App, Astal, Gdk, Gtk } from 'astal/gtk4'
import Adw from 'gi://Adw?version=1'
import GL from 'gi://GL?version=1.0'
import { bindAs, binding } from 'rxbinding'
import { getRsynapseService, RsynapseResult } from 'services/rsynapse'
import { ActionRow, ListBox } from 'widgets/adw'
import rsynapseUi, { RsynapseSearch } from 'widgets/rsynapse'

const MAX_ITEMS = 10

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
      propagate_natural_height={true}
      css_classes={['rsynapse-items']}
      valign={Gtk.Align.END}
      vexpand={false}
    >
      {listView}
    </Gtk.ScrolledWindow>
  )

  rsynapse.results.subscribe(i => {
    items.remove_all()
    i.slice(0, MAX_ITEMS).forEach(entry => items.append(entry))
    scrolledwindow.set_visible(i.length > 0)
  })

  return (
    <window
      gdkmonitor={monitor}
      visible={binding(rsynapseUi.active)}
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
        {scrolledwindow}
        <RsynapseSearch revealed={rsynapseUi.active} />
      </box>
    </window>
  )
}


//
// if (animation) {
//   animation.skip()
// }
//
// const [minHeight, nat_height] = listView.get_preferred_size()
//
// const startHeight = scrolledwindow.get_height()
// const targetHeight = nat_height.height
//
// const target = Adw.CallbackAnimationTarget['new'](value => {
//   scrolledwindow.height_request = value
// })
// console.log('from', startHeight, 'to', nat_height.height)
//
// animation = new Adw.TimedAnimation({
//   widget: scrolledwindow,
//   target: target,
//   value_from: startHeight,
//   value_to: targetHeight,
//   duration: 1000,
//   easing: Adw.Easing.LINEAR,
// })
//
// animation.connect('done', () => {
//   animation = null
//   scrolledwindow.height_request = targetHeight
// })
//
// animation.play()
// return GLib.SOURCE_REMOVE
