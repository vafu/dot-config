import AstalHyprland from 'gi://AstalHyprland?version=0.1'
import { fromConnectable } from 'rxbinding'
import {
  Observable,
  map,
  distinctUntilChanged,
  of,
  shareReplay,
  filter,
  switchMap,
  take,
  startWith,
} from 'rxjs'
import { WorkspaceService, Workspace, Tab } from '../types'

const hypr = AstalHyprland.get_default()
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
  private _workspaces: Map<number, Workspace> = new Map()

  getWorkspace = (int: number) => {
    if (!this._workspaces.get(int)) {
      const ws = new HyprWS(int)
      this._workspaces.set(int, ws)
    }
    return this._workspaces.get(int)!
  }

  activeWorkspace: Observable<Workspace> = focusedWorkspace.pipe(
    map((ws) => this.getWorkspace(getWsId(ws)))
  )
}

function getWsId(ws: AstalHyprland.Workspace) {
  return ws.id % 10
}

function getTabId(ws: AstalHyprland.Workspace) {
  return ws.id / 10
}

class HyprWS implements Workspace {
  tabs: Observable<Tab[]>
  selectedTab: Observable<Tab>

  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean> = of(false)

  private _selectedTab = 0

  constructor(id: number) {
    this.tabs = workspaces.pipe(
      map((w) =>
        w.filter((ws) => getWsId(ws) == id).map((ws) => ({ id: ws.id }))
      )
    )

    this.selectedTab = focusedWorkspace.pipe(
      filter((w) => getWsId(w) == id),
      map((w) => {
        const tab = getTabId(w)
        this._selectedTab = tab
        return {
          id: tab,
        }
      }),
      startWith({ id: this._selectedTab })
    )

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
