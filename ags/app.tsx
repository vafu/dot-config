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

    App.get_monitors().forEach((m) => Bar(m))
    App.get_monitors().forEach((m) => OSD(m))

    // NotificationPopups(App.get_monitors()[0])
    NetworkConfig()
  },
})

