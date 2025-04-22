import { App, Gtk } from 'astal/gtk4'
import Adw from 'gi://Adw?version=1'
import Bar from 'widgets/bar'
import style from './style/style'
import NetworkConfig from 'widgets/bar_dropdown'
import OSD from 'widgets/osd'
import { GLib } from 'astal'
App.start({
  css: style,
  main() {
    Adw.init()
    const d = App.get_monitors()[0].display
    const t = Gtk.IconTheme.get_for_display(d)
    const s = Gtk.Settings.get_for_display(d)
    s.set_property("gtk-icon-theme-name", "Material")
    console.log(t.get_search_path())
    console.log(t.has_icon('action-mic-symbolic'))
    console.log(t.theme_name)

    App.get_monitors().forEach((m) => Bar(m))
    App.get_monitors().forEach((m) => OSD(m))


    // NotificationPopups(App.get_monitors()[0])
    NetworkConfig()
  },
})
