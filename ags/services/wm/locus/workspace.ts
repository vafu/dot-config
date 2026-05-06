import GObject from 'gi://GObject?version=2.0'
import Gdk from 'gi://Gdk?version=4.0'
import { combineLatest, distinctUntilChanged, filter, map, Observable, of, scan, shareReplay, startWith, switchMap } from 'rxjs'
import { getLocusService } from 'services/locus'
import { Tab, Window, Workspace, WorkspaceService } from '../types'
import { booleanProperty$, numberProperty$, property$, workspaceId, workspaceSubject } from './common'
import { windowFromSubject } from './window'

function sameArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

const DEFAULT_MONITOR_WIDTH = 1920
const COLUMN_GAP_PX = 12

interface ColumnTab {
  column: number
  window: string
  tileWidth: number
  tab: Tab
}

interface ViewportState {
  viewportOffsetPx: number
  lastColumns: number[]
  monitorWidth: number
}

function sameColumnTabs(left: ColumnTab[], right: ColumnTab[]) {
  return left.length === right.length
    && left.every((value, index) =>
      value.column === right[index].column
      && value.window === right[index].window
      && value.tileWidth === right[index].tileWidth,
    )
}

function calculateViewportOffset(
  selectedColumn: number,
  tabs: ColumnTab[],
  state: ViewportState,
): ViewportState {
  if (selectedColumn <= 0 || tabs.length === 0) {
    return { viewportOffsetPx: 0, lastColumns: [], monitorWidth: state.monitorWidth }
  }

  const columns = new Map<number, { left: number; right: number }>()
  let position = 0
  for (const item of tabs) {
    const width = Math.max(1, item.tileWidth || state.monitorWidth)
    columns.set(item.column, { left: position, right: position + width })
    position += width + COLUMN_GAP_PX
  }

  const selected = columns.get(selectedColumn)
  if (!selected) {
    return {
      viewportOffsetPx: Math.max(0, state.viewportOffsetPx),
      lastColumns: tabs.map(item => item.column),
      monitorWidth: state.monitorWidth,
    }
  }

  let viewportOffsetPx = state.viewportOffsetPx
  if (selected.right > viewportOffsetPx + state.monitorWidth) {
    viewportOffsetPx = selected.right - state.monitorWidth
  } else if (selected.left < viewportOffsetPx) {
    viewportOffsetPx = selected.left
  }

  return {
    viewportOffsetPx: Math.max(0, viewportOffsetPx),
    lastColumns: tabs.map(item => item.column),
    monitorWidth: state.monitorWidth,
  }
}

class LocusWorkspaceService implements WorkspaceService {
  private _workspaces = new Map<number, LocusWorkspace>()
  activeWorkspace: Observable<Workspace> = getLocusService().selectedWorkspace$.pipe(
    map(workspaceId),
    filter(id => id > 0),
    map(id => this.getWorkspace(id)),
    shareReplay(1),
  )

  getWorkspace(id: number): Workspace {
    if (!this._workspaces.has(id)) this._workspaces.set(id, new LocusWorkspace(id))
    return this._workspaces.get(id)!
  }

  activeWorkspaceFor(monitor: Gdk.Monitor): Observable<Workspace> {
    return this.workspacesOn(monitor).pipe(
      switchMap(workspaces =>
        getLocusService().selectedWorkspace$.pipe(
          map(selected => {
            const id = workspaceId(selected)
            return workspaces.find(workspace => workspace.wsId === id) ?? this.getWorkspace(id)
          }),
        ),
      ),
      filter(workspace => workspace.wsId > 0),
      distinctUntilChanged(),
      shareReplay(1),
    )
  }

  workspacesOn(monitor: Gdk.Monitor): Observable<Workspace[]> {
    return getLocusService().sources$(`output:${monitor.connector}`, 'output').pipe(
      map(subjects => subjects.filter(subject => subject.startsWith('workspace:'))),
      map(subjects => subjects.sort((left, right) => workspaceId(left) - workspaceId(right))),
      distinctUntilChanged(sameArray),
      map(subjects => subjects.map(subject => this.getWorkspace(workspaceId(subject)))),
      shareReplay(1),
    )
  }

  switchToWs(_idx: number, _move: boolean): void {
    throw new Error('Workspace switching is not implemented through Locus yet')
  }
}

class LocusWorkspace extends GObject.Object implements Workspace {
  static {
    GObject.registerClass(this)
  }

  wsId: number
  name: Observable<string>
  tabs: Observable<Tab[]>
  selectedTab: Observable<Tab>
  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean>
  activeWindow: Observable<Window>
  viewportOffset: Observable<number>

  constructor(id: number) {
    super()
    this.wsId = id
    const subject = workspaceSubject(id)
    const locus = getLocusService()

    this.name = property$(subject, 'name').pipe(shareReplay(1))
    this.active = locus.selectedWorkspace$.pipe(
      map(selected => selected === subject),
      distinctUntilChanged(),
      shareReplay(1),
    )
    this.urgent = booleanProperty$(subject, 'urgent')

    const windowSubjects$ = locus.sources$(subject, 'workspace').pipe(
      map(sources => sources.filter(source => source.startsWith('window:'))),
      shareReplay({ bufferSize: 1, refCount: true }),
    )

    this.occupied = windowSubjects$.pipe(
      map(subjects => subjects.length > 0),
      distinctUntilChanged(),
      shareReplay(1),
    )

    this.activeWindow = combineLatest([locus.selectedWindow$, this.active]).pipe(
      map(([selected, active]) => active ? windowFromSubject(selected) : windowFromSubject('')),
      shareReplay(1),
    )

    const selectedColumn$ = combineLatest([locus.selectedWindow$, this.active]).pipe(
      switchMap(([selected, active]) => {
        if (!active || !selected) return of(0)
        return numberProperty$(selected, 'column', 0)
      }),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    )

    const columnTabs$ = windowSubjects$.pipe(
      switchMap(subjects => {
        if (subjects.length === 0) return of([] as ColumnTab[])
        return combineLatest(subjects.map((window, index) =>
          combineLatest([
            numberProperty$(window, 'column', index + 1),
            numberProperty$(window, 'tile-width', DEFAULT_MONITOR_WIDTH),
          ]).pipe(
            map(([column, tileWidth]) => {
              const win = windowFromSubject(window)
              return {
                column: column > 0 ? column : index + 1,
                window,
                tileWidth: tileWidth > 0 ? tileWidth : DEFAULT_MONITOR_WIDTH,
                tab: {
                  workspace: this,
                  title: win.title,
                  icon: win.icon,
                  width: numberProperty$(window, 'tile-width', DEFAULT_MONITOR_WIDTH).pipe(
                    map(width => Math.max(0.05, Math.min(1, width / DEFAULT_MONITOR_WIDTH))),
                    distinctUntilChanged(),
                  ),
                  isActive: selectedColumn$.pipe(
                    map(selectedColumn => selectedColumn === (column > 0 ? column : index + 1)),
                    distinctUntilChanged(),
                    startWith(false),
                  ),
                } as Tab,
              } as ColumnTab
            }),
          ),
        ))
      }),
      map(items => {
        const byColumn = new Map<number, ColumnTab>()
        for (const item of [...items].sort((left, right) => left.column - right.column)) {
          const existing = byColumn.get(item.column)
          if (!existing || existing.tileWidth < item.tileWidth) byColumn.set(item.column, item)
        }
        return Array.from(byColumn.values()).sort((left, right) => left.column - right.column)
      }),
      distinctUntilChanged(sameColumnTabs),
      shareReplay({ bufferSize: 1, refCount: true }),
    )

    this.tabs = columnTabs$.pipe(
      map(items => items.map(item => item.tab)),
      startWith([]),
      shareReplay(1),
    )

    this.selectedTab = combineLatest([columnTabs$, selectedColumn$]).pipe(
      map(([items, selectedColumn]) =>
        items.find(item => item.column === selectedColumn)?.tab ?? items[0]?.tab,
      ),
      filter(tab => tab != null),
      distinctUntilChanged(),
      shareReplay(1),
    )

    this.viewportOffset = combineLatest([columnTabs$, selectedColumn$]).pipe(
      scan(
        (state, [tabs, selectedColumn]) => calculateViewportOffset(selectedColumn, tabs, state),
        { viewportOffsetPx: 0, lastColumns: [], monitorWidth: DEFAULT_MONITOR_WIDTH } as ViewportState,
      ),
      map(state => state.viewportOffsetPx / state.monitorWidth),
      distinctUntilChanged(),
      startWith(0),
      shareReplay(1),
    )
  }

  switchToTab(_idx: number, _move: boolean): void {
    throw new Error('Tab switching is not implemented through Locus yet')
  }
}

export const locusWorkspaceService: WorkspaceService = new LocusWorkspaceService()
