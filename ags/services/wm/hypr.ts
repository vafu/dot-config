import { WorkspaceService, WR, WS, ActiveWindow, WindowService } from './types'
import AstalHyprland from 'gi://AstalHyprland?version=0.1'
import { filter, Observable, shareReplay, startWith, take } from 'rxjs'
import { fromConnectable } from 'rxbinding'
import { distinctUntilChanged, map, of, switchMap } from 'rxjs'

const hypr = AstalHyprland.get_default()

const focusedClient = fromConnectable(hypr, 'focusedClient')
const activeWindow: ActiveWindow = {
  cls: focusedClient.pipe(
    switchMap((c) => (c == null ? of('') : fromConnectable(c, 'class')))
  ),
  title: focusedClient.pipe(
    switchMap((c) => (c == null ? of('') : fromConnectable(c, 'title')))
  ),
}

export const windowService: WindowService = {
  active: activeWindow,
}

const focusedWorkspace = fromConnectable(hypr, 'focusedWorkspace')
const workspaces = fromConnectable(hypr, 'workspaces')

const urgentWs = new Observable<number>((o) => {
  const id = hypr.connect('urgent', (s, id) => {
    const wsid = s.get_workspaces().find((w) => w.get_last_client() === id)?.id
    o.next(wsid)
  })
  return () => hypr.disconnect(id)
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

  activeWorkroom: Observable<WR> = focusedWorkspace.pipe(
    map((w) => this.getWr(w.id)),
    distinctUntilChanged()
  )

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
  urgent: Observable<boolean> = of(false)

  constructor(id: number) {
    this.active = focusedWorkspace.pipe(
      map((w) => w.id == id),
      distinctUntilChanged(),
      shareReplay(1)
    )
    this.occupied = workspaces.pipe(
      map((w) => w.map((ws) => [ws.id, ws.clients.length == 0])),
      distinctUntilChanged(),
      map((ws) => ws.some(([i, isEmpty]) => i == id && !isEmpty)),
      shareReplay(1)
    )

    this.urgent = urgentWs.pipe(
      filter((i) => i == id),
      switchMap(() =>
        this.active.pipe(
          filter((active) => active),
          map((active) => !active),
          take(1),
          startWith(true)
        )
      ),
      startWith(false)
    )
  }
}

export const workspaceService: WorkspaceService = new HyprWorkspaceService()
