import { Gdk } from 'astal/gtk4'
import {
  combineLatest,
  combineLatestAll,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  Observable,
  shareReplay,
  switchMap,
  window,
} from 'rxjs'
import { Tab, Workspace, WorkspaceService } from '../types'
import AstalNiri from 'gi://AstalNiri?version=0.1'
import { fromConnectable } from 'rxbinding'
import { mapToMonitor } from './monitors'
import { GObject } from 'astal'
import { Tabs } from 'widgets/bar/tabs'
import { logNext } from 'commons/rx'

const niri = AstalNiri.get_default()

const workspaces = fromConnectable(niri, 'workspaces')
const outputs = fromConnectable(niri, 'outputs')
const focusedWs = fromConnectable(niri, 'focusedWorkspace')
const focusedWindow = fromConnectable(niri, 'focusedWindow')

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

    const thisWs = workspaces.pipe(
      map(a => a.find(w => w.idx == idx)),
      filter(w => w != null),
      shareReplay(1),
    )

    this.tabs = thisWs.pipe(
      switchMap(w => fromConnectable(w, 'windows')),
      filter(a => a.length > 0),
      distinctUntilChanged((p, c) => p.map(w => w.id) == c.map(w => w.id)),
      switchMap(a =>
        combineLatest(
          a.map(w =>
            fromConnectable(w, 'layout').pipe(
              map(l => ({
                window: w,
                col_idx: l.pos_in_scrolling_layout[0],
              })),
              distinctUntilChanged((p, c) => c.col_idx == p.col_idx),
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
              title: focusedWindow.pipe(
                switchMap(w =>
                  w.layout.pos_in_scrolling_layout[0] == v.col_idx
                    ? fromConnectable(w, 'title')
                    : fromConnectable(v.window, 'title'),
                ),
              ),
            } as Tab
          }
        }
        return result
      }),
      shareReplay(1),
    )

    this.selectedTab = this.tabs.pipe(
      switchMap(tabs =>
        focusedWindow.pipe(
          map(w => tabs[w.layout.pos_in_scrolling_layout[0] - 1]),
        ),
      ),
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
