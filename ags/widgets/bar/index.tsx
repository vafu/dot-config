import { Astal, Gdk, Gtk } from 'astal/gtk4'
import { Workspaces } from './workspaces'
import { PanelButtons } from './panel-buttons'
import { Status } from './status'
import { bindAs, binding } from 'rxbinding'
import rsynapseUi, { Rsynapse, RsynapseSearch } from 'widgets/rsynapse'
import { switchMap, map, of, distinctUntilChanged, shareReplay } from 'rxjs'
import obtainWmService from 'services'
import { TabNumIndicator, TabsCarousel } from './tabs_carousel'
import Adw from 'gi://Adw?version=1'
import { CarouselIndicatorDots } from 'widgets/adw'
import { MPRISWidget } from './mpris'

const activeMonitor = obtainWmService('monitor').activeMonitor

export default (gdkmonitor: Gdk.Monitor) => {
  const revealRsynapse = rsynapseUi.active.pipe(
    switchMap(active =>
      active ? activeMonitor.pipe(map(m => m == gdkmonitor)) : of(false),
    ),
    distinctUntilChanged(),
    shareReplay(),
  )

  const tabs = (<TabsCarousel monitor={gdkmonitor} />) as Adw.Carousel

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
    >
      <centerbox>
        <box>
          <Workspaces monitor={gdkmonitor} />
          <Status />
          <MPRISWidget />
        </box>
        <centerbox>
          <box>
            <TabNumIndicator monitor={gdkmonitor} />
            <CarouselIndicatorDots
              css_classes={['dots-carousel']}
              setup={self => self.set_carousel(tabs)}
            />
          </box>
          <overlay>
            <revealer
              revealChild={bindAs(revealRsynapse, r => !r)}
              transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
              halign={Gtk.Align.CENTER}
            >
              {tabs}
            </revealer>
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
        <PanelButtons />
      </centerbox>
    </window>
  )
}
