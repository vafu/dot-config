import { Astal, Gdk } from 'astal/gtk4'
import rsynapseUi from 'widgets/rsynapse'
import {
  switchMap,
  map,
  of,
  distinctUntilChanged,
  shareReplay,
  startWith,
} from 'rxjs'
import obtainWmService from 'services'
import { MPRISWidget } from './mpris'
import { getPomodoroService } from 'services/pomodoro'
import { PomodoroWidget } from './pomodoro'
import { TabsCarousel } from './tabs_carousel'
import { WSCarousel } from './ws_carousel'
import { Tray } from './tray'
import {
  SysStats,
  DateTime,
  BatteryIndicator,
  EthIndicator,
  PowerProfilesIndicator,
  WifiIndicator,
} from './indicators'
import { BluetoothStatus } from './bt_status'

const activeMonitor = (await obtainWmService('monitor')).activeMonitor

const pomodoro_bar_css = getPomodoroService().state.pipe(
  distinctUntilChanged(
    (p, c) => p.state == c.state && c.elapsed - p.elapsed < 60,
  ),
  map(s => {
    if (s.state == 'pomodoro') {
      const progress = s.elapsed / s.duration
      if (progress < 0.5)
        return `mix(@bg_mixed_green, @bg_mixed_yellow, ${progress * 2})`
      return `mix(@bg_mixed_yellow, @bg_mixed_red, ${progress * 2 - 1})`
    }
    return '@bg'
  }),
  startWith('transparent'),
  map(r => `@define-color custombg ${r};`),
  shareReplay(1),
)

export default (gdkmonitor: Gdk.Monitor) => {
  const revealRsynapse = rsynapseUi.active.pipe(
    switchMap(active =>
      active ? activeMonitor.pipe(map(m => m == gdkmonitor)) : of(false),
    ),
    distinctUntilChanged(),
    shareReplay(1),
  )

  return (
    <window
      visible={true}
      gdkmonitor={gdkmonitor}
      name="Bar"
      cssClasses={['bar']}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      keymode={Astal.Keymode.NONE}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      setup={w => {
        // const bgProvider = new Gtk.CssProvider()
        // const colorProvider = new Gtk.CssProvider()
        // w.get_style_context().add_provider(
        //   bgProvider,
        //   Gtk.STYLE_PROVIDER_PRIORITY_USER,
        // )
        // w.get_style_context().add_provider(
        //   colorProvider,
        //   Gtk.STYLE_PROVIDER_PRIORITY_USER,
        // )
        //
        // const css = `
        //     window {
        //       background-color: @custombg;
        //       transition: background-color 100ms;
        //     }
        // `
        // bgProvider.load_from_data(css, -1)
        //
        // const sub = pomodoro_bar_css.subscribe(css =>
        //   colorProvider.load_from_data(css, -1),
        // )
        // w.connect('destroy', sub.unsubscribe)
      }}
    >
      <centerbox>
        {/** left **/}
        <box>
          <box cssClasses={['barblock']}>
            <WSCarousel monitor={gdkmonitor} />
          </box>
          <box cssClasses={['barblock']}>
            <SysStats />
          </box>
          <box cssClasses={['barblock']}>
            <MPRISWidget />
          </box>
        </box>

        {/** center **/}
        <box cssClasses={['barblock']}>
          <TabsCarousel monitor={gdkmonitor} />
        </box>

        {/** right **/}
        <box>
          <box>
            <box cssClasses={['barblock']}>
              <Tray />
              <PowerProfilesIndicator />
              <BluetoothStatus />
              <EthIndicator />
              <WifiIndicator />
              <BatteryIndicator />
            </box>
            <box cssClasses={['barblock']}>
              <PomodoroWidget />
            </box>
            <box cssClasses={['barblock']}>
              <DateTime />
            </box>
          </box>
        </box>
      </centerbox>
    </window>
  )
}
