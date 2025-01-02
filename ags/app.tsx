import { App } from 'astal/gtk4'
import Adw from 'gi://Adw?version=1'
import Bar from 'widgets/bar'
import style from './style/style'
import NetworkConfig from 'widgets/bar_dropdown'

App.start({
  css: style,
  main() {
    // Adw.init()
    // App.get_monitors().forEach((m) => Bar(m))
    // NetworkConfig()
    w(App.get_monitors()[0])
  },
})

function w(monitor) {
  return (
    <window gdkmonitor={monitor}>
      <label label={'kek'} />
    </window>
  )
}
