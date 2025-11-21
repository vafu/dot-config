import { Gdk, Gtk, Widget } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'
import Pango from 'gi://Pango?version=1.0'
import { binding } from 'rxbinding'
import { Subscription, switchMap } from 'rxjs'
import obtainWmService from 'services'
import { Tab } from 'services/wm/types'
import { WidgetProps } from 'widgets'

const workspaceService = await obtainWmService('workspace')

export const TabsCarousel = (props: { monitor: Gdk.Monitor } & WidgetProps) => {
  const activeWs = workspaceService.activeWorkspaceFor(props.monitor)
  const tabs = activeWs.pipe(switchMap(w => w.tabs))
  const selectedTab = activeWs.pipe(switchMap(w => w.selectedTab))

  const carousel = new Adw.Carousel({
    orientation: Gtk.Orientation.HORIZONTAL,
    css_classes: (props.cssClasses ?? []).concat(['tab-carousel']),
    allow_mouse_drag: false,
    allow_scroll_wheel: false,
    hexpand: true,
  })

  carousel.set_spacing(12)

  // hacky, but do I really care?
  let firstSelect = true
  activeWs.subscribe(_ => (firstSelect = true))

  let selectedtabsub: Subscription | null = null

  // TODO: figure out diffs
  tabs.subscribe(tabs => {
    if (!!selectedtabsub) selectedtabsub.unsubscribe()
    while (carousel.get_n_pages() > 0) {
      carousel.remove(carousel.get_first_child())
    }

    tabs.forEach(tab => {
      const tabView = Tab(tab)
      tabView['tabId'] = tab.tabId
      carousel.append(tabView)
    })

    selectedtabsub = selectedTab.subscribe(tab => {
      for (let i = 0; i < carousel.get_n_pages(); i++) {
        const page = carousel.get_nth_page(i) as Gtk.Label
        if (page['tabId'] == tab.tabId) {
          carousel.scroll_to(page, !firstSelect)
          page.add_css_class('selected')
          page.set_halign(Gtk.Align.CENTER)
          firstSelect = false
        } else {
          page.remove_css_class('selected')
          page.set_halign(
            page['tabId'] > tab.tabId ? Gtk.Align.START : Gtk.Align.END,
          )
        }
      }
    })
  })

  return carousel
}

const Tab = (tab: Tab) => (
  <Widget.Label
    label={binding(tab.title, '')}
    ellipsize={Pango.EllipsizeMode.END}
    max_width_chars={50}
    cssName="carouseltab"
  />
)


