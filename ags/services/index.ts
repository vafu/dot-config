import { windowService, workspaceService } from "./wm/hypr"
import { WindowService } from "./wm/window"
import { WorkspaceService } from "./wm/workspace"

export interface Services {
    workspace: WorkspaceService
    window: WindowService
}

export default function obtainService<S extends keyof Services>(type: S): Services[S] {
    switch (type) {
        case "window": return windowService as Services[S]
        case "workspace": return workspaceService as Services[S]
    }
}
