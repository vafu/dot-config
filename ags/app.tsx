import { App, Gdk, Gtk } from 'astal/gtk4'
import Adw from 'gi://Adw?version=1'
import Bar from 'widgets/bar'
import style from './style/style'
import OSD from 'widgets/osd'
import { binding } from 'rxbinding'
import { diffs } from 'commons/rx'
import { Rsynapse } from 'widgets/rsynapse'
import { handleRequest } from 'services/requests'
import { prepareTheme } from 'style/theming'
import obtainWmService from 'services'
import { bindCommands } from 'commands'

App.start({
  css: style,
  requestHandler: handleRequest,
  main() {
    Adw.init()
    prepareTheme()
    bindCommands()

    const ms = obtainWmService('monitor')

    ms.monitors
      .pipe(diffs())
      .subscribe((monitors) => monitors.added.forEach((m) => Bar(m)))

    Rsynapse(binding(ms.activeMonitor))
    OSD(binding(ms.activeMonitor))
  },
})
