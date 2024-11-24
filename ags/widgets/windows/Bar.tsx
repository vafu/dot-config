import { Astal, Gdk } from "astal/gtk4"
import { Workspaces } from "../workspaces"
import { Box, CenterBox } from "../types"
import { WindowTitle } from "../windowtitle"

export default (gdkmonitor: Gdk.Monitor) =>
	<window
		gdkmonitor={gdkmonitor}
		name="Bar"
		exclusivity={Astal.Exclusivity.EXCLUSIVE}
		anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}>
		<CenterBox className="bar">
			<Workspaces />
			<WindowTitle />
			<Box />
		</CenterBox>
	</window>

