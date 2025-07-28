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

class HyprWS implements Workspace {
  tabs: Observable<Tab[]>
  selectedTab: Observable<Tab>

  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean> = of(false)
  id: number

  private _selectedTab = 0

  private set selectedTabId(value: number) {}

  hyprWsId() {
    return this._selectedTab * 10 + this.id
  }

  focus(move: boolean) {
    const cmd = move ? 'movetoworkspace' : 'workspace'
    console.log('executing', cmd, this._selectedTab)
    const target = this.hyprWsId()
    hypr.dispatch(cmd, target.toString())
  }

  switchToTab(idx: number, move: boolean) {
    this._selectedTab = idx
    console.log('moving to tab', idx, this._selectedTab)
    this.focus(move)
  }

  constructor(id: number) {
    this.id = id
    this.tabs = workspaces.pipe(
      map(w =>
        w.filter(ws => getWsId(ws) == id).map(ws => ({ id: getTabId(ws) })),
      ),
    )

    this.selectedTab = focusedWorkspace.pipe(
      filter(w => getWsId(w) == id),
      map(w => {
        const tab = getTabId(w)
        this._selectedTab = tab
        return {
          id: tab,
        }
      }),
      startWith({ id: this._selectedTab }),
    )

    this.active = focusedWorkspace.pipe(
      map(w => getWsId(w) == id),
      distinctUntilChanged(),
      shareReplay(1),
    )
    this.occupied = workspaces.pipe(
      map(w => w.map(ws => [ws.id, ws.clients.length == 0])),
      distinctUntilChanged(),
      map(ws => ws.some(([i, isEmpty]) => i == id && !isEmpty)),
      shareReplay(1),
    )

    this.urgent = urgentWs.pipe(
      filter(i => i == id),
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
