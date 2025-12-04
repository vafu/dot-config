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

/**
 * Calculate viewport offset that mimics Niri's behavior:
 * - Preserve viewport position when tabs are removed
 * - Scroll minimally to keep focused window visible
 */
function calculateViewportOffset(
  wsId: number,
  focusedWin: AstalNiri.Window | null,
  windows: AstalNiri.Window[],
  mWidth: number,
  state: {
    viewportOffsetPx: number
    lastWindowIds: string[]
    monitorWidth: number
  },
): {
  viewportOffsetPx: number
  lastWindowIds: string[]
  monitorWidth: number
} {
  if (!focusedWin || windows.length === 0) {
    return { viewportOffsetPx: 0, lastWindowIds: [], monitorWidth: mWidth }
  }

  // Build column map: colIdx -> {width, windowId, left, right}
  const gap = 12
  const columns = new Map<number, { width: number; windowId: string; left: number; right: number }>()
  
  windows.forEach(win => {
    const colIdx = win.layout.pos_in_scrolling_layout[0]
    const width = win.layout.tile_size[0]
    if (!columns.has(colIdx) || columns.get(colIdx)!.width < width) {
      columns.set(colIdx, { width, windowId: win.id.toString(), left: 0, right: 0 })
    }
  })

  // Calculate positions by iterating columns in order
  let cumulativePos = 0
  Array.from(columns.keys())
    .sort((a, b) => a - b)
    .forEach(colIdx => {
      const col = columns.get(colIdx)!
      col.left = cumulativePos
      col.right = cumulativePos + col.width
      cumulativePos += col.width + gap
    })

  const focusedColIdx = focusedWin.layout.pos_in_scrolling_layout[0]
  const focusedCol = columns.get(focusedColIdx)
  if (!focusedCol) {
    return { viewportOffsetPx: 0, lastWindowIds: [], monitorWidth: mWidth }
  }

  const currentWindowIds = Array.from(columns.values()).map(c => c.windowId)
  const windowWasRemoved =
    state.lastWindowIds.length > 0 &&
    state.lastWindowIds.some(id => !currentWindowIds.includes(id))

  console.log(
    `[WS${wsId}] Cols=[${Array.from(columns.keys()).join(',')}] focused=${focusedColIdx} viewport=${state.viewportOffsetPx.toFixed(0)} removed=${windowWasRemoved}`,
  )

  // Start with current viewport position
  let newViewportPx = state.viewportOffsetPx

  // Only scroll if focused window is not fully visible
  const isVisible = focusedCol.left >= newViewportPx && focusedCol.right <= newViewportPx + mWidth

  if (!isVisible) {
    if (focusedCol.right > newViewportPx + mWidth) {
      newViewportPx = focusedCol.right - mWidth
    } else if (focusedCol.left < newViewportPx) {
      newViewportPx = focusedCol.left
    }
    console.log(`[WS${wsId}] Scrolling to ${newViewportPx.toFixed(0)} to show focused col`)
  } else if (windowWasRemoved) {
    console.log(`[WS${wsId}] Window removed, viewport preserved`)
  }

  return {
    viewportOffsetPx: Math.max(0, newViewportPx),
    lastWindowIds: currentWindowIds,
    monitorWidth: mWidth,
  }
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
          switchMap(name =>
            outputs.pipe(
              map(a => a.find(o => o.name == name)),
              filter(o => !!o),
            ),
          ),
        ),
      ),
      switchMap(o => fromConnectable(o, 'logical')),
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
              workspace: this,
              title: fromConnectable(v.window, 'title'),
              icon: clientToWindow(v.window).icon,
              width: fromConnectable(v.window, 'layout').pipe(
                map(l => l.tile_size[0] / monitorWidth),
                distinctUntilChanged(),
              ),
              isActive: focusedWindowOn(id).pipe(
                map(w => w.layout.pos_in_scrolling_layout[0] === v.col_idx),
                distinctUntilChanged(),
                startWith(false),
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
      distinctUntilChanged(),
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
    this.viewportOffset = combineLatest([
      focusedWindowOn(id).pipe(startWith(null)),
      thisWs.pipe(switchMap(w => fromConnectable(w, 'windows'))),
      monitorWidth,
    ]).pipe(
      scan(
        (state, [focusedWin, windows, mWidth]) =>
          calculateViewportOffset(id, focusedWin, windows, mWidth, state),
        { viewportOffsetPx: 0, lastWindowIds: [], monitorWidth: 1920 },
      ),
      map(state => state.viewportOffsetPx / state.monitorWidth),
      distinctUntilChanged(),
      shareReplay(1),
    )
  }

  switchToTab(idx: number, move: boolean): void {
    throw new Error('Not supported in niri')
  }
}

export const workspaceService: WorkspaceService = new NiriWorkspaceService()











