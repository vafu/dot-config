import { Astal, Gdk, Gtk } from 'astal/gtk4'
import { Workspaces } from './workspaces'
import { WindowTitle } from './windowtitle'
import { PanelButtons } from './panel-buttons'
import { Status } from './status'
import { RsynapseSearch, selection } from 'widgets/rsynapse'
import { bindAs, binding } from 'rxbinding'
import rsynapseUi from 'widgets/rsynapse'

export default (gdkmonitor: Gdk.Monitor) => (
  <window
    visible={true}
    gdkmonitor={gdkmonitor}
    name="Bar"
    cssClasses={['bar']}
    exclusivity={Astal.Exclusivity.EXCLUSIVE}
    keymode={bindAs(rsynapseUi.active, (a) =>
      a ? Astal.Keymode.EXCLUSIVE : Astal.Keymode.NONE
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
      <box>
        <RsynapseSearch />
        <WindowTitle visible={bindAs(rsynapseUi.active, (a) => !a)} />
      </box>
      <PanelButtons />
    </centerbox>
  </window>
)
