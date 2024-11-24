import GObject, { property, register } from "astal/gobject"
import { bind, Variable } from "astal"

export class WorkspaceService {

    private _active_workroom = Variable(0)
    get active_workroom() { return this._active_workroom }

    private _workrooms: Map<number, WR> = new Map()

    getWorkroom(idx: number) {
        if (!this._workrooms.get(idx)) {
            const wr = new WR()
            wr.connect("notify::active", active => {
                if (active)
                    this._active_workroom.set(idx)
            })
            this._workrooms.set(idx, wr)
        }
        return this._workrooms.get(idx)!
    }
}

@register()
class WR extends GObject.Object {

    @property(Number)
    declare active_workspace: number

    @property(Boolean)
    declare active: boolean

    private _length = 7
    get length() { return this._length }

    private _workspaces: Map<number, WS> = new Map()

    getWorkspace(idx: number) {
        if (!this._workspaces.get(idx)) {
            const ws = new WS()
            bind(ws, "active").subscribe((isActive) => {
                if (isActive) {
                    this.active = true
                    this.active_workspace = idx
                } else {
                    const stillActive = Array.from(this._workspaces.values()).some(w => w.active)
                    this.active = stillActive
                }
            })
            this._workspaces.set(idx, ws)
        }
        return this._workspaces.get(idx)!
    }


}

@register()
class WS extends GObject.Object {

    @property(Boolean)
    declare active: boolean

    @property(Boolean)
    declare occupied: boolean

    @property(Boolean)
    declare urgent: boolean
    //
    @property(WS)
    get changed(): WS {
        return this
    }

    get ws() { return this }

    override notify(property_name: string): void {
        super.notify(property_name)
        super.notify("changed")
    }
}

const ws = new WorkspaceService
export default ws
