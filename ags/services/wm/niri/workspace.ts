import { Gdk } from 'astal/gtk4'
import {
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  Observable,
  shareReplay,
  switchMap,
} from 'rxjs'
import { Tab, Workspace, WorkspaceService } from '../types'
import AstalNiri from 'gi://AstalNiri?version=0.1'
import { fromConnectable } from 'rxbinding'
import { mapToMonitor } from './monitors'
import { GObject } from 'astal'

const niri = AstalNiri.get_default()

const workspaces = fromConnectable(niri, 'workspaces')
const focusedWs = fromConnectable(niri, 'focusedWorkspace')
const outputs = fromConnectable(niri, 'outputs')

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
    return combineLatest([focusedWs, this.workspacesOn(monitor)]).pipe(
      map(([focused, wsa]) => wsa.find(w => w.wsId == focused.idx)),
      filter(w => w != null),
      map(w => this.getWorkspace(w.wsId)),
      distinctUntilChanged(),
    )
  }

  workspacesOn(monitor: Gdk.Monitor): Observable<Workspace[]> {
    return outputs.pipe(
      map(a => a.find(o => mapToMonitor(o) == monitor)),
      switchMap(o => fromConnectable(o, 'workspaces')),
      map(a => a.map(w => this.getWorkspace(w.idx))),
    )
  }

  switchToWs(idx: number, move: boolean): void {
    throw new Error('Method not implemented.')
  }
}

class NiriWorkspace extends GObject.Object implements Workspace {
  static {
    GObject.registerClass(this)
  }

  wsId: number
  tabs: Observable<Tab[]>
  selectedTab: Observable<Tab>
  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean>

  constructor(idx: number) {
    super()
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
    this.urgent = thisWs.pipe(switchMap(w => fromConnectable(w, 'isUrgent')))
  }

  switchToTab(idx: number, move: boolean): void {
    throw new Error('Not supported in niri')
  }
}

export const workspaceService: WorkspaceService = new NiriWorkspaceService()
