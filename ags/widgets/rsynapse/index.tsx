import { Gio, GObject } from 'astal'
import { App, Astal, Gdk, Gtk } from 'astal/gtk4'
import Adw from 'gi://Adw?version=1'
import { bindAs } from 'rxbinding'
import { getRsynapseService, RsynapseResult } from 'services/rsynapse'
import { Entry, SearchEntry } from 'widgets'
import { ActionRow, ListBox } from 'widgets/adw'

const rsynapse = getRsynapseService()

export function Rsynapse(monitor: Gdk.Monitor) {
  const items = new Gio.ListStore({ item_type: ResultObject.$gtype })
  const selection = new Gtk.SingleSelection({ model: items })
  selection.set_autoselect(true)

  const factory = new Gtk.SignalListItemFactory()

  factory.connect("setup", (self, listItem: Gtk.ListItem) => {
    const row = <ActionRow />
    listItem.set_child(row)
  })

  factory.connect("bind", (self, listItem: Gtk.ListItem) => {
    const ro = listItem.get_item() as ResultObject
    const row = listItem.get_child() as Adw.ActionRow

    row.set_title(ro.title)
    row.set_subtitle(ro.description)
    row.set_icon_name(ro.icon)
  })

  const listView = new Gtk.ListView({
    model: selection,
    factory: factory,
    focusable: false
  })

  listView.connect("activate", (self, position) => {
    const item = selection.get_item(position) as ResultObject
    console.log(item)
  })

  rsynapse.results.subscribe(i => {
    items.remove_all()
    i.forEach(entry => items.append(new ResultObject(entry)))
  })

  const keycontroller = new Gtk.EventControllerKey()

  keycontroller.connect("key-pressed", (_, keyval, keycode, state) => {
    console.log(keyval)
    if (keyval == Gdk.KEY_Down) {
      selection.select_item(selection.selected + 1, true)
      return true
    } else if (keyval == Gdk.KEY_Up) {
      selection.select_item(selection.selected - 1, true)
      return true
    }
  })

  return (
    <window
      gdkmonitor={monitor}
      visible={false}
      application={App}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      name={'rsynapse'}
      // TODO: should be Exclusive
      keymode={Astal.Keymode.ON_DEMAND}
      cssClasses={['rsynapse']}
      setup={self => {
        self.add_controller(keycontroller)
      }}
    >
      <box orientation={Gtk.Orientation.VERTICAL}>
        <box
        // canFocus={false}
        // canTarget={false}
        >
          <SearchEntry
            vexpand={false}
            canTarget={true}
            canFocus={true}
            focusable={true}
            hexpand={true}
            setup={(self) => {
              self.connect('search-changed', (e) => rsynapse.search(e.get_text()))
              self.connect('activate', (e) => {
                (selection.get_item(selection.selected) as ResultObject).launch()
                self.set_text("")
                App.toggle_window("rsynapse")
              })
              self.connect('stop-search', (e) => {
                self.set_text("")
                App.toggle_window("rsynapse")
              })
            }}
          />
        </box>
        <Gtk.ScrolledWindow
          vscrollbarPolicy={Gtk.PolicyType.NEVER}
          name='scroll'
          propagateNaturalWidth={true}
          propagateNaturalHeight={true}
          minContentHeight={10}
          vexpand={false}
        >
          {listView}
        </Gtk.ScrolledWindow>
      </box>
    </window>
  )
}

export class ResultObject extends GObject.Object {
  // Define the GObject properties that will hold our data.
  static {
    GObject.registerClass({
      Properties: {
        id: GObject.ParamSpec.string('id', 'ID', 'Result ID', GObject.ParamFlags.READWRITE, null),
        title: GObject.ParamSpec.string('title', 'Title', 'Result Title', GObject.ParamFlags.READWRITE, null),
        description: GObject.ParamSpec.string('description', 'Description', 'Result Description', GObject.ParamFlags.READWRITE, null),
        icon: GObject.ParamSpec.string('icon', 'Icon', 'Result Icon Name', GObject.ParamFlags.READWRITE, null),
        command: GObject.ParamSpec.string('command', 'Command', 'Result Command', GObject.ParamFlags.READWRITE, null),
      },
    }, this);
  }

  // Declare the properties for TypeScript's type system.
  id: string;
  title: string;
  description: string;
  icon: string;
  command: string;

  constructor(item: RsynapseResult) {
    super()
    this.id = item.id
    this.title = item.title
    this.description = item.description
    this.icon = item.icon
    this.command = item.command
  }

  public launch() {
    const appInfo = Gio.AppInfo.create_from_commandline(
      this.command,
      this.title,
      Gio.AppInfoCreateFlags.NONE
    );
    appInfo.launch([], null);
  }
}
