import { Gdk, Gtk } from 'astal/gtk4'
import { Label } from 'astal/gtk4/widget'
import Adw from 'gi://Adw?version=1'
import { binding } from 'rxbinding'
import { Subscription } from 'rxjs'
import obtainWmService from 'services'
import { Workspace } from 'services/wm/types'

const workspaceService = await obtainWmService('workspace')

export const WSCarousel = (props: { monitor: Gdk.Monitor }) => {
  const workspaces = workspaceService.workspacesOn(props.monitor)

  const carousel = new Adw.Carousel({
    orientation: Gtk.Orientation.VERTICAL,
    allow_mouse_drag: false,
    allow_scroll_wheel: false,
  })

  let sub: Subscription | null = null

  // TODO: figure out diffs for lists
  workspaces.subscribe(workspaces => {
    if (!!sub) sub.unsubscribe()

    while (carousel.get_n_pages() > 0) {
      carousel.remove(carousel.get_first_child())
    }

    workspaces.forEach(ws => {
      const label = WSIndicator(ws)
      label['wsId'] = ws.wsId
      carousel.append(label)
    })

    sub = workspaceService.activeWorkspaceFor(props.monitor).subscribe(ws => {
      for (let i = 0; i < carousel.get_n_pages(); i++) {
        const wslabel = carousel.get_nth_page(i) as Gtk.Label
        if (wslabel['wsId'] == ws.wsId) {
          carousel.scroll_to(wslabel, carousel.get_position() != i)
          wslabel.add_css_class('selected')
        } else {
          wslabel.remove_css_class('selected')
        }
      }
    })
  })

  return carousel
}

const WSIndicator = (ws: Workspace) => <label label={binding(ws.name)} />
