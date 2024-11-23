import { bindHypr } from "./wm/hypr"
import { WorkspaceService } from "./workspace"

export interface Services {
    workspace: WorkspaceService
}

const bound = new Set<keyof Services>()

export default function obtainService<S extends keyof Services>(type: S): Services[S] {
    let service: Services[S] | null = null
    switch (type) {
        case "workspace": service = new WorkspaceService() as Services[S]
    }
    if (!service)
        throw Error("unregistered service")
    if (!bound.has(type)) {
        bound.add(type)
        bindHypr(type, service)
    }
    return service
}
