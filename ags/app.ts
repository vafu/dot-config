import { App } from 'astal/gtk4'
import Adw from 'gi://Adw?version=1'
import Bar from './widgets/windows/Bar'
import style from './style/style'
import { NetworkConfig } from 'widgets/windows/popup'

App.start({
  css: style,
  main() {
    Adw.init()
    App.get_monitors().forEach((m) => Bar(m))
    NetworkConfig()
  },
})


