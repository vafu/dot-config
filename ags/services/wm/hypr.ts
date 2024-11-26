import { WorkspaceService, WR, WS } from "./workspace"
import AstalHyprland from "gi://AstalHyprland?version=0.1"
import { ActiveWindow, WindowService } from "./window"
import { CompositeDisposable, Disposable, Observable, Subject } from "rx"
import { obs } from "rxbinding"

const hypr = AstalHyprland.get_default()

const focusedClient = obs(hypr, "focusedClient").replay().refCount()
const activeWindow: ActiveWindow = {
    cls: focusedClient.flatMapLatest(c => c == null ? Observable.just("") : obs(c, "class")),
    title: focusedClient.flatMapLatest(c => c == null ? Observable.just("") : obs(c, "title")),
}

export const windowService: WindowService = {
    active: activeWindow
}

const focusedWorkspace = obs(hypr, "focusedWorkspace").replay().refCount()

const workspaces = obs(hypr, "workspaces").replay().refCount()

const workspaceAdded = Observable.create<number>(o => {
    const id = hypr.connect("workspace-added", (_, w) => {
        o.onNext(w.id)
    })
    return Disposable.create(() => hypr.disconnect(id))
})

const workspaceRemoved = Observable.create<number>(o => {
    const id = hypr.connect("workspace-removed", (_, w) => {
        o.onNext(w)
    })
    return Disposable.create(() => hypr.disconnect(id))
})

const urgentWs = Observable.create<number>(o => {
    const id = hypr.connect("urgent", (s, id) => {
        const wsid = s.get_workspaces().find(w => w.get_last_client() === id)?.id
        o.onNext(wsid)
    })
    return Disposable.create(() => hypr.disconnect(id))
})

class HyprWorkspaceService implements WorkspaceService {

    private _workrooms: Map<number, HyprWR> = new Map()

    getWs = (int: number) => {
        const ws = int % 10
        return this.getWr(int).getWs(ws)
    }

    getWr = (int: number) => {
        const wr = Math.floor(int / 10)
        return this.getWorkroom(wr)
    }

    activeWorkroom: Observable<WR> = focusedWorkspace
        .map(w => this.getWr(w.id))
        .distinctUntilChanged()

    getWorkroom(idx: number) {
        if (!this._workrooms.get(idx)) {
            const wr = new HyprWR(idx)
            this._workrooms.set(idx, wr)
        }
        return this._workrooms.get(idx)!
    }
}

class HyprWR implements WR {

    private _workspaces: Map<number, WS> = new Map()
    private wr: number
    constructor(wr: number) {
        this.wr = wr
    }

    getWs(idx: number): WS {
        if (!this._workspaces.get(idx)) {
            const ws = new HyprWS(this.wr * 10 + idx)
            this._workspaces.set(idx, ws)
        }
        return this._workspaces.get(idx)!
    }
}

class HyprWS implements WS {
    active: Observable<boolean>
    occupied: Observable<boolean>
    urgent: Observable<boolean> = Observable.just(false)

    constructor(id: number) {
        this.active = focusedWorkspace.map(w => w.id == id).shareReplay(1)

        this.occupied = Observable.merge(
            workspaces.take(1).map(a => a.some(a => a.id == id)),
            workspaceAdded
                .filter(i => i == id)
                .map(() => true),
            workspaceRemoved
                .filter(i => i == id)
                .map(() => false),
        ).replay().refCount()

        this.urgent = urgentWs
            .filter(i => i == id)
            .flatMapLatest(() => this.active
                .filter(active => active)
                .map(active => !active)
                .take(1)
                .startWith(true)
            )
            .startWith(false)
    }
}

export const workspaceService: WorkspaceService = new HyprWorkspaceService()
