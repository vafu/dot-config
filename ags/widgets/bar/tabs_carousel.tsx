import { Gdk, Gtk } from 'astal/gtk4'
import { Button, Label } from 'astal/gtk4/widget'
import Adw from 'gi://Adw?version=1'
import Pango from 'gi://Pango?version=1.0'
import { bindAs, binding } from 'rxbinding'
import { switchMap } from 'rxjs'
import obtainWmService from 'services'
import { Tab } from 'services/wm/types'

const workspaceService = await obtainWmService('workspace')

export const TabsCarousel = (props: { monitor: Gdk.Monitor }) => {
  const activeWs = workspaceService.activeWorkspaceFor(props.monitor)
  const tabs = activeWs.pipe(switchMap(w => w.tabs))
  const selectedTab = activeWs.pipe(switchMap(w => w.selectedTab))

  const carousel = new Adw.Carousel({
    orientation: Gtk.Orientation.HORIZONTAL,
    css_classes: ['tab-carousel'],
    allow_mouse_drag: false,
    allow_scroll_wheel: false,
  })

  carousel.set_spacing(12)

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
      const page = carousel.get_nth_page(i) as Gtk.Label
      if (page['tabId'] == tab.tabId) {
        carousel.scroll_to(page, true)
        page.add_css_class('selected')
        page.set_halign(Gtk.Align.CENTER)
      } else {
        page.remove_css_class('selected')
        page.set_halign(
          page['tabId'] > tab.tabId ? Gtk.Align.START : Gtk.Align.END,
        )
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
    cssName="carouseltab"
  />
)
