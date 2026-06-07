import Gio from 'gi://Gio?version=2.0'
import { Gdk, Gtk } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'
import { Subscription } from 'rxjs'
import { activeWorkspaceForMonitor$, workspacesOnMonitor$ } from 'services/locus'
import { WidgetProps } from 'widgets'
import { WorkspaceStrip } from './workspace_strip'

export const WSMatrix = (props: { monitor: Gdk.Monitor } & WidgetProps) => {
  const workspaces = workspacesOnMonitor$(props.monitor)

  const carousel = new Adw.Carousel({
    orientation: Gtk.Orientation.VERTICAL,
    allow_mouse_drag: false,
    allow_scroll_wheel: false,
    hexpand: false,
    halign: Gtk.Align.CENTER,
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
      const strip = WorkspaceStrip(ws, { monitor: props.monitor })
      strip['workspaceSubject'] = ws.subject
      carousel.append(strip)
    })

    sub = activeWorkspaceForMonitor$(props.monitor).subscribe(ws => {
      for (let i = 0; i < carousel.get_n_pages(); i++) {
        const wsstrip = carousel.get_nth_page(i) as Gtk.Overlay
        if (wsstrip['workspaceSubject'] == ws.subject) {
          carousel.scroll_to(wsstrip, carousel.get_position() != i)
          wsstrip.add_css_class('selected')
        } else {
          wsstrip.remove_css_class('selected')
        }
      }
    })
  })

  return <overlay hexpand={false} halign={Gtk.Align.CENTER}>
    {carousel}
  </overlay>
}
