import Gdk from 'gi://Gdk?version=4.0'
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  shareReplay,
  startWith,
  switchMap,
  zip,
} from 'rxjs'
import { Tab, Window, Workspace, WorkspaceService } from '../types'
import AstalNiri from 'gi://AstalNiri?version=0.1'
import { fromConnectable } from 'rxbinding'
import { mapToMonitor } from './monitors'
import GObject from 'gi://GObject?version=2.0'
import { clientToWindow } from './window'

const niri = AstalNiri.get_default()

const workspaces = fromConnectable(niri, 'workspaces')
const outputs = fromConnectable(niri, 'outputs')
const focusedWs = fromConnectable(niri, 'focusedWorkspace')
const focusedWindow = fromConnectable(niri, 'focusedWindow')

function focusedWindowOn(wsId: number): Observable<AstalNiri.Window> {
  return focusedWindow.pipe(filter(w => w.workspace.id == wsId))
}

class NiriWorkspaceService implements WorkspaceService {
  private _workspaces: Map<number, NiriWorkspace> = new Map()

  activeWorkspace: Observable<Workspace> = focusedWs.pipe(
    map(w => this.getWorkspace(w.id)),
  )

  getWorkspace(id: number): Workspace {
    if (!this._workspaces.get(id))
      this._workspaces.set(id, new NiriWorkspace(id))
    return this._workspaces.get(id)!
  }

  activeWorkspaceFor(monitor: Gdk.Monitor): Observable<Workspace> {
    return combineLatest([focusedWs, this.workspacesOn(monitor)]).pipe(
      map(([focused, wsa]) => wsa.find(w => w.wsId == focused.id)),
      filter(w => w != null),
      map(w => this.getWorkspace(w.wsId)),
      distinctUntilChanged(),
    )
  }

  workspacesOn(monitor: Gdk.Monitor): Observable<Workspace[]> {
    return outputs.pipe(
      map(a => a.find(o => mapToMonitor(o) == monitor)),
      switchMap(o => fromConnectable(o, 'workspaces')),
      map(a => a.map(w => this.getWorkspace(w.id))),
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
  name: Observable<string>
  activeWindow: Observable<Window>

  constructor(id: number) {
    super()
    this.wsId = id

    const thisWs = workspaces.pipe(
      map(a => a.find(w => w.id == id)),
      filter(w => !!w),
      shareReplay(1),
    )

    this.name = thisWs.pipe(
      map(ws => ws.idx.toString()),
      filter(n => !!n),
      startWith(''),
      shareReplay(1),
    )

    this.activeWindow = focusedWindowOn(id).pipe(
      map(clientToWindow),
      shareReplay(1),
    )

    this.tabs = thisWs.pipe(
      switchMap(w => fromConnectable(w, 'windows')),
      filter(a => a.length > 0),
      distinctUntilChanged((p, c) => p.map(w => w.id) == c.map(w => w.id)),
      switchMap(a =>
        zip(
          a.map(w =>
            fromConnectable(w, 'layout').pipe(
              map(l => l.pos_in_scrolling_layout[0]),
              distinctUntilChanged(),
              map(pos => ({
                window: w,
                col_idx: pos,
              })),
            ),
          ),
        ),
      ),
      map(a => {
        const result = new Array<Tab>()
        for (let i = 0; i < a.length; i++) {
          const v = a[i]
          if (!result[v.col_idx - 1]) {
            result[v.col_idx - 1] = {
              tabId: v.col_idx,
              workspace: this,
              title: fromConnectable(v.window, 'title'),
              icon: clientToWindow(v.window).icon,
            } as Tab
          }
        }
        return result
      }),
      startWith([]),
      shareReplay(1),
    )

    this.selectedTab = this.tabs.pipe(
      switchMap(tabs =>
        focusedWindowOn(id).pipe(
          map(w => tabs[w.layout.pos_in_scrolling_layout[0] - 1]),
        ),
      ),
      filter(t => !!t),
      distinctUntilChanged((p, c) => p.tabId == c.tabId),
      shareReplay(1),
    )

    this.active = focusedWs.pipe(
      map(w => w.id == id),
      distinctUntilChanged(),
      shareReplay(1),
    )
    this.occupied = thisWs.pipe(
      switchMap(w => fromConnectable(w, 'windows')),
      map(w => w.length > 0),
      shareReplay(1),
    )
    this.urgent = thisWs.pipe(
      switchMap(w => fromConnectable(w, 'isUrgent')),
      shareReplay(1),
    )
  }

  switchToTab(idx: number, move: boolean): void {
    throw new Error('Not supported in niri')
  }
}

export const workspaceService: WorkspaceService = new NiriWorkspaceService()


