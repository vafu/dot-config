import { Gtk } from "astal/gtk4";
import Adw from "gi://Adw?version=1";
import { switchMap } from "rxjs";
import { workspaceService } from "services/wm/hypr";


const activeWs = workspaceService.activeWorkspace
const tabs = activeWs.pipe(switchMap(w => w.tabs))
const selectedTab = activeWs.pipe(switchMap(w => w.selectedTab))

export const AdwTabs = () => {
  const tabView = new Adw.TabView({})
  const tabbar = new Adw.TabBar({
    view: tabView,
    css_classes: ["inline"],
    autohide: false,
  })

  tabs.subscribe(a => {
    closeAllTabs(tabView)
    a.forEach(tab => {
      const page = tabView.add_page(tabPreview(), null);
      page['tabId'] = tab.id
      page.set_title(tab.title)
    })
  })

  selectedTab.subscribe(t => {
    selectTabById(tabView, t.id)
  })

  tabbar.set_hexpand(true)
  return tabbar
}

function tabPreview() {
  return new Gtk.Box()
}

function closeAllTabs(tabView: Adw.TabView) {
  for (let i = tabView.get_n_pages() - 1; i >= 0; i--) {
    const page = tabView.get_nth_page(i);
    tabView.close_page(page);
  }
}

function selectTabById(tabView: Adw.TabView, id: number) {
  for (let i = 0; i < tabView.get_n_pages(); i++) {
    const page = tabView.get_nth_page(i);

    if (page['tabId'] === id) {
      tabView.set_selected_page(page);
      return;
    }
  }
  print(`Error: Tab with ID "${id}" not found.`);
}
