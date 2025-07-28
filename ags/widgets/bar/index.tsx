import { Astal, Gdk } from 'astal/gtk4'
import { Workspaces } from './workspaces'
import { WindowTitle } from './windowtitle'
import { PanelButtons } from './panel-buttons'
import { Status } from './status'
import { RsynapseSearch } from 'widgets/rsynapse'
import { bindAs } from 'rxbinding'
import rsynapseUi from 'widgets/rsynapse'
import { switchMap, map, of, distinctUntilChanged, shareReplay } from 'rxjs'
import obtainWmService from 'services'
import { Tabs } from './tabs'

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
          <Tabs />
          <Status />
        </box>
        <overlay>
          <WindowTitle visible={bindAs(rsynapseUi.active, a => !a)} />
          <RsynapseSearch revealed={revealRsynapse} />
        </overlay>
        <PanelButtons />
      </centerbox>
    </window>
  )
}
