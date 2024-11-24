import { bindHypr } from "./wm/hypr"
import { WindowService } from "./wm/window"
import { WorkspaceService } from "./wm/workspace"

export interface Services {
    workspace: WorkspaceService
    window: WindowService
}

const bound = new Set<keyof Services>()

export default function obtainService<S extends keyof Services>(type: S): Services[S] {
    let service: Services[S] | null = null
    switch (type) {
        case "workspace": service = new WorkspaceService() as Services[S]; break
        case "window": service = new WindowService() as Services[S]; break
    }
    if (!service)
        throw Error("unregistered service")
    if (!bound.has(type)) {
        bound.add(type)
        bindHypr(type, service)
    }
    return service
}
