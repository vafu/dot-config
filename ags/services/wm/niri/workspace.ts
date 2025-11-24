import Gdk from 'gi://Gdk?version=4.0'
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  scan,
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

    const monitorWidth = thisWs.pipe(
      switchMap(ws => 
        fromConnectable(ws, 'output').pipe(
          switchMap(name => outputs.pipe(
            map(a => a.find(o => o.name == name)),
            filter(o => !!o)
          ))
        )
      ),
      switchMap(o => fromConnectable(o, "logical")),
      map(l => l.get_width()),
      distinctUntilChanged(),
      shareReplay(1),
    )

    this.tabs = combineLatest([
      thisWs.pipe(
        switchMap(w => fromConnectable(w, 'windows')),
        filter(a => a.length > 0),
        distinctUntilChanged((p, c) => p.map(w => w.id) == c.map(w => w.id)),
      ),
      monitorWidth,
    ]).pipe(
      switchMap(([windows, mWidth]) =>
        zip(
          windows.map(w =>
            fromConnectable(w, 'layout').pipe(
              map(l => ({
                col_idx: l.pos_in_scrolling_layout[0],
                tile_width: l.tile_size[0],
                window: w,
              })),
              distinctUntilChanged(
                (p, c) =>
                  p.col_idx == c.col_idx && p.tile_width == c.tile_width,
              ),
            ),
          ),
        ).pipe(map(a => ({ windows: a, monitorWidth: mWidth }))),
      ),
      map(({ windows, monitorWidth }) => {
        const result = new Array<Tab>()
        for (let i = 0; i < windows.length; i++) {
          const v = windows[i]
          if (!result[v.col_idx - 1]) {
            result[v.col_idx - 1] = {
              tabId: v.col_idx,
              workspace: this,
              title: fromConnectable(v.window, 'title'),
              icon: clientToWindow(v.window).icon,
              width: fromConnectable(v.window, 'layout').pipe(
                map(l => l.tile_size[0] / monitorWidth),
                distinctUntilChanged(),
              ),
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

    // Calculate viewport scroll position
    // Since tile_pos_in_workspace_view is null for tiled windows (niri#2381),
    // we mimic Niri's scroll behavior: viewport scrolls minimally to keep focused window visible
    this.viewportOffset = combineLatest([
      focusedWindowOn(id).pipe(startWith(null)),
      thisWs.pipe(switchMap(w => fromConnectable(w, 'windows'))),
      monitorWidth,
    ]).pipe(
      map(([focusedWin, windows, mWidth]) => {
        if (!focusedWin || windows.length === 0) {
          return null
        }

        const layout = focusedWin.layout
        const focusedColIdx = layout.pos_in_scrolling_layout[0]

        // Build map of column index to column width
        const columnWidths = new Map<number, number>()
        windows.forEach(win => {
          const winLayout = win.layout
          const colIdx = winLayout.pos_in_scrolling_layout[0]
          const tileWidth = winLayout.tile_size[0]
          // Use max width if multiple windows in same column
          columnWidths.set(
            colIdx,
            Math.max(columnWidths.get(colIdx) || 0, tileWidth),
          )
        })

        // Calculate focused tab's absolute position in pixels
        const gap = 12
        let focusedTabLeft = 0
        for (let i = 1; i < focusedColIdx; i++) {
          if (columnWidths.has(i)) {
            focusedTabLeft += columnWidths.get(i)! + gap
          }
        }
        const focusedTabWidth = columnWidths.get(focusedColIdx) || 0
        const focusedTabRight = focusedTabLeft + focusedTabWidth

        // Normalize to 0-1 range
        const left = focusedTabLeft / mWidth
        const right = focusedTabRight / mWidth

        console.log(
          `[WS${id}] focusedCol=${focusedColIdx}, tabLeft=${left.toFixed(3)}, tabRight=${right.toFixed(3)}`,
        )

        return { left, right }
      }),
      // Use scan to track viewport state and scroll minimally to show focused tab
      scan((currentOffset, focusedTab) => {
        if (!focusedTab) return 0

        const viewportRight = currentOffset + 1.0

        // Scroll to keep focused tab visible
        if (focusedTab.right > viewportRight) {
          // Tab extends past right edge
          return focusedTab.right - 1.0
        } else if (focusedTab.left < currentOffset) {
          // Tab starts before left edge
          return focusedTab.left
        }

        // Tab is fully visible, no scroll needed
        return currentOffset
      }, 0),
      distinctUntilChanged(),
      shareReplay(1),
    )
  }

  switchToTab(idx: number, move: boolean): void {
    throw new Error('Not supported in niri')
  }
}

export const workspaceService: WorkspaceService = new NiriWorkspaceService()

