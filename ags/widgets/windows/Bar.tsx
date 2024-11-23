import { Astal, Gdk } from "astal/gtk4"
import { Workspaces } from "../workspaces"

export default (gdkmonitor: Gdk.Monitor) =>
	<window
		gdkmonitor={gdkmonitor}
		name="Bar"
		exclusivity={Astal.Exclusivity.EXCLUSIVE}
		anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}>
		<Workspaces />
	</window>
