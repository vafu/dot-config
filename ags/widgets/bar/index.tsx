import { Astal, Gdk } from 'astal/gtk4'
import { Workspaces } from './workspaces'
import { WindowTitle } from './windowtitle'
import { PanelButtons } from './panel-buttons'

export default (gdkmonitor: Gdk.Monitor) => (
  <window
    visible={true}
    gdkmonitor={gdkmonitor}
    name="Bar"
    cssClasses={['bar']}
    exclusivity={Astal.Exclusivity.EXCLUSIVE}
    anchor={
      Astal.WindowAnchor.TOP |
      Astal.WindowAnchor.LEFT |
      Astal.WindowAnchor.RIGHT
    }
  >
    <centerbox>
      <Workspaces />
      <WindowTitle />
      <PanelButtons />
    </centerbox>
  </window>
)
