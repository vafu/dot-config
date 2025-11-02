import { Gdk } from 'astal/gtk4'
import {
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  filter,
  flatMap,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs'
import { Tab, Workspace, WorkspaceService } from '../types'
import AstalNiri from 'gi://AstalNiri?version=0.1'
import { fromConnectable } from 'rxbinding'
import { mapToMonitor } from './monitors'
import { logNext } from 'commons/rx'

const niri = AstalNiri.get_default()

const workspaces = fromConnectable(niri, 'workspaces')
const focusedWs = fromConnectable(niri, 'focusedWorkspace')
const windows = fromConnectable(niri, 'windows')

class NiriWorkspaceService implements WorkspaceService {
  private _workspaces: Map<number, NiriWorkspace> = new Map()

  activeWorkspace: Observable<Workspace> = focusedWs.pipe(
    map(w => this.getWorkspace(w.idx)),
  )

  getWorkspace(id: number): Workspace {
    if (!this._workspaces.get(id))
      this._workspaces.set(id, new NiriWorkspace(id))
    return this._workspaces.get(id)!
  }
  activeWorkspaceFor(monitor: Gdk.Monitor): Observable<Workspace> {
    return focusedWs.pipe(
      // TODO handle case when ws moves to different monitor
      filter(
        ws =>
          mapToMonitor(niri.get_outputs().find(o => o.name == ws.output)) ==
          monitor,
      ),
      map(ws => this.getWorkspace(ws.idx)),
      distinctUntilChanged(),
    )
  }

  workspacesOn(monitor: Gdk.Monitor): Observable<Workspace[]> {
    return workspaces.pipe(
      map(wa =>
        wa
          .filter(
            ws =>
              mapToMonitor(niri.get_outputs().find(o => o.name == ws.output)) ==
              monitor,
          )
          .map(ws => this.getWorkspace(ws.idx)),
      ),
    )
  }

  switchToWs(idx: number, move: boolean): void {
    throw new Error('Method not implemented.')
  }
}

class NiriWorkspace implements Workspace {
  wsId: number
  tabs: Observable<Tab[]>
  selectedTab: Observable<Tab>
  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean>

  constructor(idx: number) {
    this.wsId = idx
    this.tabs = EMPTY
    this.selectedTab = EMPTY
    const thisWs = workspaces.pipe(
      map(a => a.find(w => w.idx == idx)),
      filter(w => w != null),
      shareReplay(1),
    )
    this.active = focusedWs.pipe(
      map(w => w.idx == idx),
      distinctUntilChanged(),
      shareReplay(1),
    )
    this.occupied = thisWs.pipe(
      switchMap(w => fromConnectable(w, 'windows')),
      map(w => w.length > 0),
    )
    this.urgent = thisWs.pipe(map(w => w.isUrgent))
  }

  switchToTab(idx: number, move: boolean): void {
    throw new Error('Not supported in niri')
  }
}

export const workspaceService: WorkspaceService = new NiriWorkspaceService()
