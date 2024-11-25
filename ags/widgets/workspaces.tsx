import { range } from "../commons"
import Service from "../services"
import { Box, Label } from "./types"
import Gtk from "gi://Gtk?version=4.0"
import { binding } from "rxbinding"
import { Observable } from "rx"

const workspaceService = Service("workspace")

const workspaces = workspaceService.activeWorkroom
    .doOnNext(w => console.log(w))
    .map(wr =>
        range(7)
            .map(idx => wr.getWs(idx))
            .map(ws => <Label
                valign={Gtk.Align.CENTER}
                halign={Gtk.Align.CENTER}
                label={`${ws}`}
                css_classes={binding(Observable.combineLatest(
                    ws.active.map(a => a ? "active" : ""),
                    ws.urgent.map(a => a ? "urgent" : ""),
                    ws.occupied.map(a => a ? "occupied" : ""),
                ))}
            />)
    )

export const Workspaces = () =>
    <Box className="workspaces bar-widget" >
        {binding(workspaces)}
    </Box>

// http://google.com
