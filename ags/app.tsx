logDebug("importing gtk")
import { App, Gtk } from 'astal/gtk4'
import Adw from 'gi://Adw?version=1'
import Bar from 'widgets/bar'
import style from './style/style'
import NetworkConfig from 'widgets/bar_dropdown'
import OSD from 'widgets/osd'
import { GLib } from 'astal'
import { logDebug } from 'logger'


App.start({
  css: style,
  main() {
    Adw.init()
    const d = App.get_monitors()[0].display
    const t = Gtk.IconTheme.get_for_display(d)
    const s = Gtk.Settings.get_for_display(d)
    s.set_property("gtk-icon-theme-name", "Material")
    console.log("using gtk theme", t.theme_name)

    App.get_monitors().forEach((m) => {
      console.log("Creating bar for ", m)
      return Bar(m)
    })
    App.get_monitors().forEach((m) => {
      console.log("Creating OSD for")
      return OSD(m)
    })

    // NotificationPopups(App.get_monitors()[0])
  },
})
