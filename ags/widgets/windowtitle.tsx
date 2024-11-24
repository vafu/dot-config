import { bind } from "astal"
import { Box, Label } from "./types"
import Pango from "gi://Pango?version=1.0"
import Service from "../services"

const active = Service("window").activeWindow

export const WindowTitle = () => <Box className="window-title bar-widget">
    <Label
        className="cls"
        label={bind(active, "cls")} />
    <Label
        ellipsize={Pango.EllipsizeMode.END}
        label={bind(active, "title")} />
</Box>

