import { Astal, Gdk } from 'astal/gtk4'
import { Workspaces } from './workspaces'
import { PanelButtons } from './panel-buttons'
import { Status } from './status'
import { bindAs } from 'rxbinding'
import rsynapseUi from 'widgets/rsynapse'
import { switchMap, map, of, distinctUntilChanged, shareReplay } from 'rxjs'
import obtainWmService from 'services'
import { TabsCarousel } from './tabs_carousel'

const activeMonitor = obtainWmService('monitor').activeMonitor

export default (gdkmonitor: Gdk.Monitor) => {
  const revealRsynapse = rsynapseUi.active.pipe(
    switchMap(active =>
      active ? activeMonitor.pipe(map(m => m == gdkmonitor)) : of(false),
    ),
    distinctUntilChanged(),
    shareReplay(),
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
    >
      <centerbox>
        <box>
          <Workspaces />
          <Status />
        </box>
            <TabsCarousel />
        <PanelButtons />
      </centerbox>
    </window>
  )
}
