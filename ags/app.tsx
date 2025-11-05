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
import { MonitorService } from 'services/wm/types'
import { getPomodoroService } from 'services/pomodoro'
import { execAsync } from 'astal'
import { distinctUntilChanged, map, shareReplay } from 'rxjs'
import { WSSideOverlay } from 'widgets/ws-indicator'

App.start({
  css: style,
  requestHandler: handleRequest,
  main() {
    Adw.init()
    prepareTheme()
    bindCommands()

    obtainWmService('monitor').then(ms => {
      setupPomodoro()
      setupForMonitor(ms, Bar)
      Rsynapse(binding(ms.activeMonitor))
      OSD(binding(ms.activeMonitor))
    })
  },
})

function setupForMonitor(
  ms: MonitorService,
  widgetFactory: (m: Gdk.Monitor) => Gtk.Widget,
) {
  const mmap = new Map<Gdk.Monitor, Gtk.Window>()
  ms.monitors.pipe(diffs()).subscribe(monitors => {
    monitors.removed.forEach(removed => {
      const w = mmap.get(removed)
      if (w) {
        w.destroy()
        mmap.delete(removed)
      }
    })
    monitors.added.forEach(m => {
      mmap.set(m, widgetFactory(m) as Gtk.Window)
    })
  })
}

function setupPomodoro() {
  const state = getPomodoroService().state.pipe(shareReplay(1))
  state
    .pipe(
      map(s => s.state),
      distinctUntilChanged(),
    )
    .subscribe(s => {
      switch (s) {
        case 'pomodoro':
          dndOn()
          return
        case 'short-break':
        case 'long-break':
        case 'none':
          dndOff()
      }
    })

  state
    .pipe(
      map(s => {
        if (s.state == 'short-break' || s.state == 'long-break') {
          return s.elapsed / s.duration >= 0.5
        }
        return false
      }),
      distinctUntilChanged(),
    )
    .subscribe(notif => {
      if (notif) execAsync('./scripts/dnd.sh request break_ends')
    })
}

function dndOn() {
  execAsync('./scripts/dnd.sh on').catch()
}

function dndOff() {
  execAsync('./scripts/dnd.sh off').catch()
}
