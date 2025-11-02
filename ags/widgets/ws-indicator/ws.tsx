import Gtk from 'gi://Gtk?version=4.0'
import { Observable, Subscription } from 'rxjs'
import { Gdk } from 'astal/gtk4'
import obtainWmService from 'services'
import { Gio, GObject } from 'astal'
import { Workspace } from 'services/wm/types'

const items = new Gio.ListStore({})
const workspaceService = await obtainWmService('workspace')
const selection = new Gtk.NoSelection({ model: items })

export function WSIndicator(props: { monitor: Gdk.Monitor }) {
  const factory = new Gtk.SignalListItemFactory()

  factory.connect('setup', (_, listItem: Gtk.ListItem) => {
    const indicator = new WSDot()
    listItem.set_child(indicator)
  })

  factory.connect('bind', (_, listItem: Gtk.ListItem) => {
    const ws = listItem.get_item() as Workspace
    const dot = listItem.get_child() as WSDot

    dot.bindTo(ws)
  })

  factory.connect('unbind', (_, listItem: Gtk.ListItem) => {
    const dot = listItem.get_child() as WSDot
    dot.unbind()
  })

  const listView = new Gtk.ListView({
    model: selection,
    factory: factory,
    focusable: false,
    orientation: Gtk.Orientation.VERTICAL,
    vexpand: true,
    valign: Gtk.Align.CENTER,
  })

  listView.add_css_class('workspaces')

  workspaceService.workspacesOn(props.monitor).subscribe(i => {
    items.remove_all()
    i.forEach(w => items.append(w))
  })

  return listView
}

class WSDot extends Gtk.Label {
  static {
    GObject.registerClass(this)
  }

  subscriptions: Array<Subscription> = []

  constructor() {
    super()
    this.set_valign(Gtk.Align.CENTER)
    this.set_valign(Gtk.Align.CENTER)
  }

  bindTo(ws: Workspace) {
    this.set_text(ws.wsId.toString())
    this.setClassWatcher(ws.active, 'focused')
    this.setClassWatcher(ws.occupied, 'occupied')
    this.setClassWatcher(ws.urgent, 'urgent')
  }

  unbind() {
    this.subscriptions.forEach(s => s.unsubscribe())
    this.subscriptions = []
  }

  setClassWatcher(state: Observable<Boolean>, c: string) {
    this.subscriptions.push(
      state.subscribe(a => {
        if (a) {
          this.add_css_class(c)
        } else {
          this.remove_css_class(c)
        }
      }),
    )
  }
}
