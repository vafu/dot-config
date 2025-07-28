import { Gio, GObject } from 'astal'
import { Gtk } from 'astal/gtk4'
import { bindAs } from 'rxbinding'
import { workspaceService } from 'services/wm/hypr'
import { Tab, Workspace } from 'services/wm/types'

const activeWs = workspaceService.activeWorkspace

export const Tabs = () => (
  <box>{bindAs(activeWs, ws => new TabSidebar(ws))}</box>
)

/**
 * A GObject wrapper for our Tab data, required for use in a Gio.ListStore.
 */
class TabItem extends GObject.Object {
  static {
    GObject.registerClass(this)
  }
  id: number
  title: string

  constructor(tab: Tab) {
    super()
    this.id = tab.id
    this.title = `${tab.id + 1}`
  }
}

class TabSidebar extends Gtk.ScrolledWindow {
  static {
    GObject.registerClass(this)
  }
  private _workspace: Workspace
  private _store: Gio.ListStore
  private _selection: Gtk.SingleSelection
  private _isProgrammaticChange = false

  private _tabsSub: { unsubscribe: () => void }
  private _selectedTabSub: { unsubscribe: () => void }

  constructor(workspace: Workspace) {
    super({
      hscrollbar_policy: Gtk.PolicyType.NEVER,
      vscrollbar_policy: Gtk.PolicyType.NEVER,
    })

    this._workspace = workspace

    // 1. The Data Model: A list store for our TabItem objects.
    this._store = new Gio.ListStore({ item_type: TabItem.$gtype })

    // 2. The Selection Model: Wraps the store to manage which item is selected.
    this._selection = new Gtk.SingleSelection({ model: this._store })

    // 3. The Factory: A recipe to create a ToggleButton for each TabItem.
    const factory = new Gtk.SignalListItemFactory()

    factory.connect('setup', (self, listItem: Gtk.ListItem) => {
      const button = new Gtk.Label({
        css_classes: ['flat'],
        can_focus: false, // Prevents dual focus appearance
      })
      listItem.set_child(button)
    })

    factory.connect('bind', (self, listItem: Gtk.ListItem) => {
      const button = listItem.get_child() as Gtk.Label
      const tabItem = listItem.get_item() as TabItem
      button.set_label(tabItem.title)
    })

    factory.connect('unbind', (self, listItem) => {
      // Important: unbind the property when the widget is recycled.
      const binding = listItem.get_data('binding') as GObject.Binding
      if (binding) {
        binding.unbind()
      }
    })

    // 4. The View: The ListView that displays everything.
    const listView = new Gtk.ListView({
      model: this._selection,
      factory: factory,
      orientation: Gtk.Orientation.HORIZONTAL,
      css_classes: ['navigation-sidebar'],
    })

    // 5. Connect user clicks back to the workspace.
    listView.connect('activate', (self, position) => {
      this._workspace.switchToTab(position, false)
    })

    // 6. Set the ListView as the child of this ScrolledWindow.
    this.set_child(listView)

    // 7. Connect the workspace observables to our widget.
    this._tabsSub = this._workspace.tabs.subscribe(this._rebuildList.bind(this))
    this._selectedTabSub = this._workspace.selectedTab.subscribe(
      this._updateSelection.bind(this),
    )

    this.connect('destroy', () => {
      this._tabsSub?.unsubscribe()
      this._selectedTabSub?.unsubscribe()
    })
  }

  /** Populates the list store based on the tabs from the workspace. */
  private _rebuildList(tabs: Tab[]) {
    this._isProgrammaticChange = true
    this._store.remove_all()
    tabs.forEach(tab => this._store.append(new TabItem(tab)))
    this._isProgrammaticChange = false
  }

  /** Updates the list selection based on the selected tab from the workspace. */
  private _updateSelection(selectedTab: Tab | null) {
    if (this._isProgrammaticChange || !selectedTab) return

    // Find the position of the selected tab in our store
    let index = -1
    for (let i = 0; i < this._store.get_n_items(); i++) {
      const item = this._store.get_item(i) as TabItem
      if (item.id === selectedTab.id) {
        index = i
        break
      }
    }

    // Set the selected item on the selection model
    this._selection.set_selected(index)
  }
}
