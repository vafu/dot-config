import { bind } from "astal"
import { Box, Label } from "./types"
import AstalHyprland from "gi://AstalHyprland?version=0.1"
import Pango from "gi://Pango?version=1.0"

const hypr = AstalHyprland.get_default()
const active_window = bind(hypr, "focusedClient")

export const WindowTitle = () => active_window.as(window => {
    if (window != null) {
        return <Box className="window-title bar-widget">
            <Label
                className="cls"
                label={bind(window, "class")} />
            <Label
                ellipsize={Pango.EllipsizeMode.END}
                label={bind(window, "title")} />
        </Box>
    } else {
        return <Label />
    }
})

