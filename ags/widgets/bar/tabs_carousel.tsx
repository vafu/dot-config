import { Gdk, Gtk } from 'astal/gtk4'
import { Button, Label } from 'astal/gtk4/widget'
import Adw from 'gi://Adw?version=1'
import Pango from 'gi://Pango?version=1.0'
import { binding } from 'rxbinding'
import { switchMap } from 'rxjs'
import { workspaceService } from 'services/wm/hypr'
import { Tab } from 'services/wm/types'

export const TabsCarousel = (props: { monitor: Gdk.Monitor }) => {
  const activeWs = workspaceService.activeWorkspaceFor(props.monitor)
  const tabs = activeWs.pipe(switchMap(w => w.tabs))
  const selectedTab = activeWs.pipe(switchMap(w => w.selectedTab))

  const carousel = new Adw.Carousel({
    orientation: Gtk.Orientation.HORIZONTAL,
    css_classes: ['tab-carousel'],
  })

  tabs.subscribe(tabs => {
    while (carousel.get_n_pages() > 0) {
      carousel.remove(carousel.get_first_child())
    }

    tabs.forEach(tab => {
      const tabView = Tab(tab)
      tabView['tabId'] = tab.tabId
      carousel.append(tabView)
    })
  })

  selectedTab.subscribe(tab => {
    for (let i = 0; i < carousel.get_n_pages(); i++) {
      const page = carousel.get_nth_page(i) as Gtk.Button
      if (page['tabId'] == tab.tabId) {
        carousel.scroll_to(page, true)
      }
    }
  })

  return carousel
}

const Tab = (tab: Tab) => (
  <Label
    label={binding(tab.title)}
    ellipsize={Pango.EllipsizeMode.END}
    max_width_chars={50}
    cssName='carouseltab'
  />
)
