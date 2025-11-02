import { Astal, Gdk, Gtk } from 'astal/gtk4'
import { PanelButtons } from './panel-buttons'
import { Status } from './status'
import { bindAs, binding } from 'rxbinding'
import rsynapseUi, { RsynapseSearch } from 'widgets/rsynapse'
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
import { Workspaces } from './workspaces'
import { WindowTitle } from './windowtitle'

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
  startWith('@bg'),
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
      keymode={bindAs(revealRsynapse, a =>
        a ? Astal.Keymode.EXCLUSIVE : Astal.Keymode.NONE,
      )}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      setup={w => {
        const bgProvider = new Gtk.CssProvider()
        const colorProvider = new Gtk.CssProvider()
        w.get_style_context().add_provider(
          bgProvider,
          Gtk.STYLE_PROVIDER_PRIORITY_USER,
        )
        w.get_style_context().add_provider(
          colorProvider,
          Gtk.STYLE_PROVIDER_PRIORITY_USER,
        )

        const css = `
            window {
              background-color: @custombg;
              transition: background-color 100ms;
            }
        `
        bgProvider.load_from_data(css, -1)

        const sub = pomodoro_bar_css.subscribe(css =>
          colorProvider.load_from_data(css, -1),
        )
        w.connect('destroy', sub.unsubscribe)
      }}
    >
      <centerbox>
        <box>
          <Workspaces monitor={gdkmonitor} />
          <Status />
          <PomodoroWidget />
        </box>
        <centerbox>
          <box>
            {/*            <TabNumIndicator monitor={gdkmonitor} />
            <CarouselIndicatorDots
              css_classes={['dots-carousel']}
              setup={self => self.set_carousel(tabs)}
            />
*/}
          </box>
          <overlay>
            {
              <revealer
                revealChild={bindAs(revealRsynapse, r => !r)}
                transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
                halign={Gtk.Align.CENTER}
              >
                <WindowTitle />
              </revealer>
            }
            <revealer
              revealChild={binding(revealRsynapse)}
              transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
              halign={Gtk.Align.CENTER}
              type="overlay"
            >
              <RsynapseSearch revealed={revealRsynapse} />
            </revealer>
          </overlay>
        </centerbox>
        <box>
          <MPRISWidget />
          <PanelButtons />
        </box>
      </centerbox>
    </window>
  )
}
