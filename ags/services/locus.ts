import app from 'ags/gtk4/app'
import GObject from 'gi://GObject?version=2.0'
import Gdk from 'gi://Gdk?version=4.0'
import AstalApps from 'gi://AstalApps?version=0.1'
import { BehaviorSubject, Observable, combineLatest, distinctUntilChanged, filter, map, of, scan, shareReplay, startWith, switchMap } from 'rxjs'
import { locus } from './locus.generated'

export interface LocusTab {
  workspace: LocusWorkspace
  title: Observable<string>
  icon: Observable<string>
  width: Observable<number>
  height: Observable<number>
  xValue: number
  yValue: number
  widthValue: number
  heightValue: number
  isActive: Observable<boolean>
}

const apps = AstalApps.Apps.new()
const iconNameCache = new Map<string, string>()
const workspaces = new Map<number, LocusWorkspace>()

const DEFAULT_MONITOR_WIDTH = 1920
const COLUMN_GAP_PX = 12

interface ColumnTab {
  column: number
  row: number
  window: string
  tileWidth: number
  tileHeight: number
  tab: LocusTab
}

interface ColumnTile {
  column: number
  row: number
  window: string
  tileWidth: number
  tileHeight: number
}

interface ViewportState {
  viewportOffsetPx: number
  lastColumns: number[]
  monitorWidth: number
}

export function firstProjectName(project: string, properties: Record<string, string>) {
  return properties.displayName
    || properties['display-name']
    || properties.title
    || properties.name
    || properties.path?.split('/').filter(Boolean).pop()
    || project
}

export function getIconForAppId(appId: string): string {
  let icon = iconNameCache.get(appId)
  if (!icon) {
    const app = apps.list.find(a => a.entry.toLowerCase().includes(appId.toLowerCase()))
    if (!app) return ''
    icon = app.iconName
    iconNameCache.set(appId, icon)
  }
  return icon
}

export function workspaceSubject(id: number) {
  return `workspace:${id}`
}

export function workspaceId(subject: string) {
  return Number(subject.replace(/^workspace:/, '')) || 0
}

function sameArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function sameColumnTabs(left: ColumnTab[], right: ColumnTab[]) {
  return left.length === right.length
    && left.every((value, index) =>
      value.column === right[index].column
      && value.row === right[index].row
      && value.window === right[index].window
      && value.tileWidth === right[index].tileWidth
      && value.tileHeight === right[index].tileHeight,
    )
}

function calculateViewportOffset(
  selectedColumn: number,
  tabs: ColumnTab[],
  state: ViewportState,
): ViewportState {
  const monitorWidth = Math.max(...tabs.map(item => item.tileWidth), state.monitorWidth, 1)
  if (selectedColumn <= 0 || tabs.length === 0) {
    return { viewportOffsetPx: 0, lastColumns: [], monitorWidth }
  }

  const columns = new Map<number, { left: number; right: number }>()
  let position = 0
  for (const item of tabs) {
    const width = Math.max(1, item.tileWidth || monitorWidth)
    columns.set(item.column, { left: position, right: position + width })
    position += width + COLUMN_GAP_PX
  }

  const selected = columns.get(selectedColumn)
  if (!selected) {
    return {
      viewportOffsetPx: Math.max(0, state.viewportOffsetPx),
      lastColumns: tabs.map(item => item.column),
      monitorWidth,
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
    monitorWidth,
  }
}

function monitors() {
  return app.get_monitors().filter((monitor): monitor is Gdk.Monitor => monitor != null)
}

function monitorByConnector(connector: string) {
  return monitors().find(monitor => monitor.connector === connector) ?? monitors()[0]
}

export class LocusWorkspace extends GObject.Object {
  static {
    GObject.registerClass(this)
  }

  wsId: number
  name: Observable<string>
  tabs: Observable<LocusTab[]>
  selectedTab: Observable<LocusTab>
  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean>
  viewportOffset: Observable<number>

  constructor(id: number) {
    super()
    this.wsId = id
    const subject = workspaceSubject(id)

    this.name = locus.property$(subject, 'name').pipe(shareReplay(1))
    this.active = locus.selectedWorkspaceString$().pipe(
      map(selected => selected === subject),
      distinctUntilChanged(),
      shareReplay(1),
    )
    this.urgent = locus.booleanProperty$(subject, 'urgent')

    const windowSubjects$ = locus.sources$(subject, 'workspace').pipe(
      map(sources => sources.filter(source => source.startsWith('window:'))),
      shareReplay(1),
    )

    this.occupied = windowSubjects$.pipe(
      map(subjects => subjects.length > 0),
      distinctUntilChanged(),
      shareReplay(1),
    )

    const selectedColumn$ = combineLatest([locus.selectedWindowString$(), this.active]).pipe(
      switchMap(([selected, active]) => {
        if (!active || !selected) return of(0)
        return locus.numberProperty$(selected, 'column', 0)
      }),
      distinctUntilChanged(),
      shareReplay(1),
    )

    const columnTabs$ = windowSubjects$.pipe(
      switchMap(subjects => {
        if (subjects.length === 0) return of([] as ColumnTile[])
        return combineLatest(subjects.map((window, index) =>
          combineLatest([
            locus.numberProperty$(window, 'column', index + 1),
            locus.numberProperty$(window, 'row', 1),
            locus.numberProperty$(window, 'tile-width', DEFAULT_MONITOR_WIDTH),
            locus.numberProperty$(window, 'tile-height', DEFAULT_MONITOR_WIDTH),
          ]).pipe(
            map(([column, row, tileWidth, tileHeight]) => {
              const resolvedColumn = column > 0 ? column : index + 1
              return {
                column: resolvedColumn,
                row: row > 0 ? row : 1,
                window,
                tileWidth: tileWidth > 0 ? tileWidth : DEFAULT_MONITOR_WIDTH,
                tileHeight: tileHeight > 0 ? tileHeight : DEFAULT_MONITOR_WIDTH,
              } as ColumnTile
            }),
          ),
        ))
      }),
      map(tiles => {
        const sortedColumns = [...new Set(tiles.map(tile => tile.column))].sort((left, right) => left - right)
        const columnWidths = new Map<number, number>()
        const columnOffsets = new Map<number, number>()
        let offset = 0

        for (const column of sortedColumns) {
          const width = Math.max(...tiles.filter(tile => tile.column === column).map(tile => tile.tileWidth), 1)
          columnWidths.set(column, width)
          columnOffsets.set(column, offset)
          offset += width + COLUMN_GAP_PX
        }

        return [...tiles]
          .sort((left, right) => left.column - right.column || left.row - right.row)
          .map(tile => {
            const xValue = columnOffsets.get(tile.column) ?? 0
            const yValue = (tile.row - 1) * tile.tileHeight
            const widthValue = columnWidths.get(tile.column) ?? tile.tileWidth
            const heightValue = tile.tileHeight
            return {
              ...tile,
              tab: {
                workspace: this,
                title: of(''),
                icon: windowIcon$(tile.window),
                width: of(widthValue),
                height: of(heightValue),
                xValue,
                yValue,
                widthValue,
                heightValue,
                isActive: combineLatest([
                  selectedColumn$,
                  locus.selectedWindowString$(),
                ]).pipe(
                  map(([selectedColumn, selected]) =>
                    selected === tile.window || selectedColumn === tile.column,
                  ),
                  distinctUntilChanged(),
                  startWith(false),
                ),
              } as LocusTab,
            } as ColumnTab
          })
      }),
      distinctUntilChanged(sameColumnTabs),
      shareReplay(1),
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
      map(state => state.viewportOffsetPx),
      distinctUntilChanged(),
      startWith(0),
      shareReplay(1),
    )
  }
}

const standardWindowIcon$ = (window: string) =>
  locus.property$(window, 'app-id').pipe(
    map(getIconForAppId),
    distinctUntilChanged(),
  )

export const windowIcon$ = (window: string) =>
  locus.targets$(window, 'app-instance').pipe(
    switchMap(targets => {
      const appInstance = targets[0]
      if (!appInstance) return standardWindowIcon$(window)

      return locus.property$(appInstance, 'icon').pipe(
        switchMap(icon => icon ? of(icon) : standardWindowIcon$(window)),
      )
    }),
    distinctUntilChanged(),
    shareReplay(1),
  )

export const workspace$ = (id: number) => {
  if (!workspaces.has(id)) workspaces.set(id, new LocusWorkspace(id))
  return workspaces.get(id)!
}

export const selectedWindowIcon$ = locus.selectedWindowString$().pipe(
  switchMap(window => windowIcon$(window)),
  distinctUntilChanged(),
  shareReplay(1),
)

export const monitors$ = new BehaviorSubject<Gdk.Monitor[]>(monitors()).pipe(shareReplay(1))

export const activeMonitor$ = locus.selectedOutputProperty$('connector').pipe(
  distinctUntilChanged(),
  map(monitorByConnector),
  filter(monitor => monitor != null),
  distinctUntilChanged(),
  shareReplay(1),
)

export const activeWorkspace$ = locus.selectedWorkspaceString$().pipe(
  map(workspaceId),
  filter(id => id > 0),
  map(workspace$),
  shareReplay(1),
)

export const workspacesOnMonitor$ = (monitor: Gdk.Monitor) => locus.sources$(`output:${monitor.connector}`, 'output').pipe(
  map(subjects => subjects.filter(subject => subject.startsWith('workspace:'))),
  map(subjects => subjects.sort((left, right) => workspaceId(left) - workspaceId(right))),
  distinctUntilChanged(sameArray),
  map(subjects => subjects.map(subject => workspace$(workspaceId(subject)))),
  shareReplay(1),
)

export const activeWorkspaceForMonitor$ = (monitor: Gdk.Monitor) => combineLatest([
  locus.selectedWorkspaceString$(),
  workspacesOnMonitor$(monitor),
]).pipe(
  map(([selected, monitorWorkspaces]) => {
    const id = workspaceId(selected)
    return monitorWorkspaces.find(workspace => workspace.wsId === id) ?? workspace$(id)
  }),
  filter(workspace => workspace.wsId > 0),
  distinctUntilChanged(),
  shareReplay(1),
)
