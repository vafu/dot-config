import { Gdk, Gtk } from 'ags/gtk4'
import app from "ags/gtk4/app"
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
import { MonitorService } from 'services/wm/types'

app.start({
  css: style,
  requestHandler: handleRequest,
  main() {
    Adw.init()
    prepareTheme()
    bindCommands()

    const ms = obtainWmService('monitor')

    setupBars(ms)
    Rsynapse(binding(ms.activeMonitor))
    OSD(binding(ms.activeMonitor))
  },
})

function setupBars(ms: MonitorService) {
  const mmap = new Map<Gdk.Monitor, Gtk.Window>()
  ms.monitors
    .pipe(diffs())
    .subscribe((monitors) => {
      monitors.removed.forEach(removed => {
        const bar = mmap.get(removed)
        if (bar) {
          bar.destroy()
          mmap.delete(removed)
        }
      })
      monitors.added.forEach((m) => {
        mmap.set(m, Bar(m) as Gtk.Window)
      })
    })
}
