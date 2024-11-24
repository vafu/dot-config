import { bind } from "../../../../../../usr/share/astal/gjs"
import { Services } from "../index"
import { WorkspaceService } from "./workspace"
import AstalHyprland from "gi://AstalHyprland?version=0.1"

const hypr = AstalHyprland.get_default()

export function bindHypr<S extends keyof Services>(type: S, service: Services[S]) {
    switch (type) {
        case "workspace": return bindWorkspace(service as WorkspaceService)
    }
}

function bindWorkspace(workspaceService: WorkspaceService) {
    const getWs = (int: number) => {
        const wr = Math.floor(int / 10)
        const ws = int % 10
        return workspaceService.getWorkroom(wr).getWorkspace(ws)
    }

    let last = getWs(hypr.focusedWorkspace.id)
    last.active = true

    bind(hypr, "focusedWorkspace").subscribe((w) => {
        last.active = false
        last = getWs(w.id)
        last.active = true
        last.urgent = false
    })

    hypr.get_workspaces()
        .forEach(w => getWs(w.get_id()).occupied = w.get_clients().length > 0)

    hypr.connect("workspace-added", (_, w) => {
        getWs(w.get_id()).occupied = true
    })
    hypr.connect("workspace-removed", (_, w) => {
        getWs(w).occupied = false
    })

    hypr.connect("urgent", (s, id) => {
        const wsid = s.get_workspaces().find(w => w.get_last_client() === id)?.id
        if (wsid)
            getWs(wsid).urgent = true
    })
}
