import { Observable } from "rx"

export interface WorkspaceService {
    activeWorkroom: Observable<WR>
}

export interface WR {
    getWs(idx: number): WS
}

export interface WS {
    active: Observable<boolean>
    occupied: Observable<boolean>
    urgent: Observable<boolean>
}
