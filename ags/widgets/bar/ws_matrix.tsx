import Gio from 'gi://Gio?version=2.0'
import { Gdk, Gtk } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'
import { bindAs, binding } from 'rxbinding'
import { BehaviorSubject, Observable, Subscription } from 'rxjs'
import obtainWmService from 'services'
import { Workspace } from 'services/wm/types'
import { WidgetProps } from 'widgets'
import { Accessor, createRoot } from 'gnim'
import { WorkspaceStrip } from './workspace_strip'

const workspaceService = await obtainWmService('workspace')

export const WSMatrix = (props: { monitor: Gdk.Monitor } & WidgetProps) => {
  const workspaces = workspaceService.workspacesOn(props.monitor)

  const carousel = new Adw.Carousel({
    orientation: Gtk.Orientation.VERTICAL,
    allow_mouse_drag: false,
    allow_scroll_wheel: false,
    hexpand: true,
    cssClasses: (props.cssClasses ?? []).concat(['ws-carousel']),
  })

  let sub: Subscription | null = null

  // TODO: figure out diffs for lists
  workspaces.subscribe(workspaces => {
    if (!!sub) sub.unsubscribe()

    while (carousel.get_n_pages() > 0) {
      carousel.remove(carousel.get_first_child()!!)
    }

    workspaces.forEach(ws => {
      const strip = WorkspaceStrip(ws)
      strip['wsId'] = ws.wsId
      carousel.append(strip)
    })

    sub = workspaceService.activeWorkspaceFor(props.monitor).subscribe(ws => {
      for (let i = 0; i < carousel.get_n_pages(); i++) {
        const wsstrip = carousel.get_nth_page(i) as Gtk.Overlay
        if (wsstrip['wsId'] == ws.wsId) {
          carousel.scroll_to(wsstrip, carousel.get_position() != i)
          wsstrip.add_css_class('selected')
        } else {
          wsstrip.remove_css_class('selected')
        }
      }
    })
  })

  return carousel
}

