import { App, Gdk, Gtk } from 'astal/gtk4'
import Adw from 'gi://Adw?version=1'
import Bar from 'widgets/bar'
import style from './style/style'
import OSD from 'widgets/osd'
import { fromConnectable } from 'rxbinding'
import { diffs } from 'commons/rx'
import AstalHyprland from 'gi://AstalHyprland?version=0.1'
import { filter, map, Observable, retry, Subject, take } from 'rxjs'
import { Rsynapse } from 'widgets/rsynapse'
import { handleRequest } from 'services/requests'

App.start({
  css: style,
  requestHandler: handleRequest,
  main() {
    Adw.init()
    const d = App.get_monitors()[0].display
    const t = Gtk.IconTheme.get_for_display(d)
    const s = Gtk.Settings.get_for_display(d)
    s.set_property('gtk-icon-theme-name', 'Material')
    console.log('using gtk theme', t.theme_name)

    monitors()
      .pipe(diffs())
      .subscribe((monitors) => monitors.added.forEach((m) => Bar(m)))

    Rsynapse(App.get_monitors()[0])

    App.get_monitors().forEach((m) => {
      OSD(m)
    })
  },
})

function monitors(): Observable<Gdk.Monitor[]> {
  return fromConnectable(AstalHyprland.get_default(), 'monitors').pipe(
    map((monitors) =>
      monitors.map((m) =>
        App.get_monitors().find(
          (am) =>
            am.description.startsWith(m.description) ||
            m.description.startsWith(am.description)
        )
      )
    ),
    retry({
      count: 2,
      delay: 1000,
    })
  )
}
