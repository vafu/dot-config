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
  share,
} from 'rxjs'
import { WorkspaceService, Workspace, Tab } from '../types'
import { logNext } from 'commons/rx'

const hypr = AstalHyprland.get_default()
const focusedWorkspace = fromConnectable(hypr, 'focusedWorkspace')
const workspaces = fromConnectable(hypr, 'workspaces')

const urgentWs = new Observable<number>(o => {
  const id = hypr.connect('urgent', (s, id) => {
    const wsid = s.get_workspaces().find(w => w.get_last_client() === id)?.id
    o.next(wsid)
  })
  return () => hypr.disconnect(id)
})

class HyprWorkspaceService implements WorkspaceService {
  private _workspaces: Map<number, HyprWS> = new Map()

  getWorkspace = (int: number) => {
    if (!this._workspaces.get(int)) {
      const ws = new HyprWS(int)
      this._workspaces.set(int, ws)
    }
    return this._workspaces.get(int)!
  }

  activeWorkspace: Observable<Workspace> = focusedWorkspace.pipe(
    map(ws => this.getWorkspace(getWsId(ws))),
    distinctUntilChanged()
  )

  switchToWs(idx: number, move: boolean) {
    this.getWorkspace(idx).focus(move)
  }
}

function getWsId(ws: AstalHyprland.Workspace) {
  return ws.id % 10
}

function getTabId(ws: AstalHyprland.Workspace) {
  return Math.floor(ws.id / 10)
}

function wsToTab(ws: AstalHyprland.Workspace): Tab {
  const id = getTabId(ws)
  return { id: id, title: `#${id + 1}` }
}

class HyprWS implements Workspace {
  tabs: Observable<Tab[]>
  selectedTab: Observable<Tab>

  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean> = of(false)
  id: number

  private _selectedTab = 0

  hyprWsId() {
    return this._selectedTab * 10 + this.id
  }

  focus(move: boolean) {
    const cmd = move ? 'movetoworkspace' : 'workspace'
    const target = this.hyprWsId()
    hypr.dispatch(cmd, target.toString())
  }

  switchToTab(idx: number, move: boolean) {
    this._selectedTab = idx
    this.focus(move)
  }

  constructor(id: number) {
    this.id = id
    this.tabs = workspaces.pipe(
      map(w =>
        w.filter(ws => getWsId(ws) == id).map(ws => (wsToTab(ws))).sort((p, c) => p.id - c.id),
      ),
      distinctUntilChanged(),
      shareReplay()
    )

    this.selectedTab = focusedWorkspace.pipe(
      filter(w => getWsId(w) == id),
      map(w => {
        // TODO: meh
        const tab = getTabId(w)
        this._selectedTab = tab
        return wsToTab(w)
      }
      ),
      startWith({ id: this._selectedTab, title: "init, fix me" }),
      shareReplay()
    )

    this.active = focusedWorkspace.pipe(
      map(w => getWsId(w) == id),
      distinctUntilChanged(),
      shareReplay(),
    )
    this.occupied = workspaces.pipe(
      map(w => w.filter(ws => getWsId(ws) === id && ws.clients.length > 0)),
      distinctUntilChanged(),
      map(ws => ws.length > 0),
      shareReplay(),
    )

    this.urgent = urgentWs.pipe(
      filter(wsId => wsId && wsId % 10 === id),
      switchMap(() =>
        this.active.pipe(
          filter(active => active),
          map(active => !active),
          take(1),
          startWith(true),
        ),
      ),
      startWith(false),
    )
  }
}
export const workspaceService: WorkspaceService = new HyprWorkspaceService()
