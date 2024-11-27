import { Astal, Gdk } from 'astal/gtk4'
import { CenterBox } from 'widgets'
import { Workspaces } from './workspaces'
import { WindowTitle } from './windowtitle'
import { PanelButtons } from './panel-buttons'

export default (gdkmonitor: Gdk.Monitor) => (
  <window
    gdkmonitor={gdkmonitor}
    name="Bar"
    className="bar"
    exclusivity={Astal.Exclusivity.EXCLUSIVE}
    anchor={
      Astal.WindowAnchor.TOP |
      Astal.WindowAnchor.LEFT |
      Astal.WindowAnchor.RIGHT
    }
  >
    <CenterBox>
      <Workspaces />
      <WindowTitle />
      <PanelButtons />
    </CenterBox>
  </window>
)
