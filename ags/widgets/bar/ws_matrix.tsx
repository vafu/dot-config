import Gio from 'gi://Gio?version=2.0'
import { Gdk, Gtk } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'
import { bindAs, binding } from 'rxbinding'
import { BehaviorSubject, Observable, Subscription } from 'rxjs'
import obtainWmService from 'services'
import { Workspace } from 'services/wm/types'
import { WidgetProps } from 'widgets'
import { Accessor, createRoot } from 'gnim'

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
      const label = WSCarousel(ws)
      label['wsId'] = ws.wsId
      carousel.append(label)
    })

    sub = workspaceService.activeWorkspaceFor(props.monitor).subscribe(ws => {
      for (let i = 0; i < carousel.get_n_pages(); i++) {
        const wscarousel = carousel.get_nth_page(i) as Adw.Carousel
        if (wscarousel['wsId'] == ws.wsId) {
          carousel.scroll_to(wscarousel, carousel.get_position() != i)
          wscarousel.add_css_class('selected')
        } else {
          wscarousel.remove_css_class('selected')
        }
      }
    })
  })

  return carousel
}

const WSCarousel = (ws: Workspace) => {
  const carousel = new Adw.Carousel({
    orientation: Gtk.Orientation.HORIZONTAL,
    allow_mouse_drag: false,
    allow_scroll_wheel: false,
    css_classes: ['ws-matrix'],
  })

  carousel.set_spacing(12)

  let selectedtabsub: Subscription | null = null

  // TODO: figure out diffs
  ws.tabs.subscribe(tabs => {
    if (!!selectedtabsub) selectedtabsub.unsubscribe()
    while (carousel.get_n_pages() > 0) {
      carousel.remove(carousel.get_first_child()!!)
    }

    tabs.forEach(tab => {
      const subject = new BehaviorSubject(false)
      const tabView = TintedIcon({
        tinted: binding(subject, false),
        fileOrIcon: tab.icon,
      })
      tabView['tabId'] = tab.tabId
      tabView['subject'] = subject
      carousel.append(tabView)
    })

    let firstSelect = true
    selectedtabsub = ws.selectedTab.subscribe(tab => {
      for (let i = 0; i < carousel.get_n_pages(); i++) {
        const page = carousel.get_nth_page(i) as Gtk.Overlay
        if (page['tabId'] == tab.tabId) {
          carousel.scroll_to(page, !firstSelect)
          page['subject'].next(false)
          firstSelect = false
        } else {
          page['subject'].next(true)
        }
      }
    })
  })

  return (
    <overlay>
      <revealer
        hexpand={true}
        vexpand={true}
        transitionType={Gtk.RevealerTransitionType.CROSSFADE}
        revealChild={bindAs(ws.active, a => !a, true)}
      >
        <box hexpand={true} vexpand={true} css_classes={['tint']} />
      </revealer>
      {carousel}
    </overlay>
  )
}

const TintedIcon = (
  props: Partial<Gtk.Image.ConstructorProps & {
    tinted: Accessor<boolean> | boolean
    fileOrIcon: Observable<string>
  }>,
) => {
  const { tinted, fileOrIcon, children, ...imageProps } = props 
  const image = new Gtk.Image(imageProps)

  fileOrIcon.subscribe(p => {
    const file = Gio.file_new_for_path(p)
    if (file.query_exists(null)) {
      image.set_from_file(p)
    } else {
      image.set_from_icon_name(p)
    }
  })

  const overlay = new Gtk.Overlay()
  const revealer = createRoot(() => (
    <revealer
      hexpand={true}
      vexpand={true}
      transitionType={Gtk.RevealerTransitionType.CROSSFADE}
      revealChild={tinted}
    >
      <box hexpand={true} vexpand={true} css_classes={['tint']} />
    </revealer>
  )) as Gtk.Revealer

  overlay.add_overlay(revealer)
  overlay.set_child(image)

  return overlay
}
