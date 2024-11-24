import { bind } from "astal"
import { range } from "../commons"
import Service from "../services"
import { Box, Label } from "./types"
import Gtk from "gi://Gtk?version=4.0"

const workspaces = Service("workspace")

export const Workspaces = () =>
    <Box className="workspaces bar-widget" >
        {workspaces.active_workroom().as(wr =>
            range(workspaces.getWorkroom(wr).length).map(ws => {
                const workspace = workspaces.getWorkroom(wr).getWorkspace(ws)
                return <Label
                    valign={Gtk.Align.CENTER}
                    halign={Gtk.Align.CENTER}
                    label={`${ws}`}
                    css_classes={bind(workspace, "changed").as(ws => [
                        ws.active ? "active" : "",
                        ws.urgent ? "urgent" : "",
                        ws.occupied ? "occupied" : ""
                    ].filter(s => s.length > 0))}
                />
            })
        )}
    </Box>
