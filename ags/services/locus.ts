import app from 'ags/gtk4/app'
import GObject from 'gi://GObject?version=2.0'
import Gdk from 'gi://Gdk?version=4.0'
import AstalApps from 'gi://AstalApps?version=0.1'
import { BehaviorSubject, Observable, catchError, combineLatest, distinctUntilChanged, filter, map, of, scan, shareReplay, startWith, switchMap } from 'rxjs'
import {
  LocusDbusClient,
  LocusWatch,
  path as schemaPath,
  type NamedPath,
  type OptionalNodeId,
  type PropertyKey,
  type Relation,
} from './locus.generated'

export interface LocusProject {
  subject: string
  name: string
  icon: string
  path: string
  properties: Record<string, string>
}

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

export interface LocusService {
  activeProject$: Observable<LocusProject | null>
  selectedWorkspace$: Observable<string>
  selectedWindow$: Observable<string>
  selectedAgentSession$: Observable<string>
  selectedAgentSessionId$: Observable<string>
  selectedOutput$: Observable<string>
  selectedWindowTitle$: Observable<string>
  selectedWindowAppId$: Observable<string>
  selectedWindowIcon$: Observable<string>
  monitors$: Observable<Gdk.Monitor[]>
  activeMonitor$: Observable<Gdk.Monitor>
  refreshActiveProject: () => void
  getTargets: (source: string, relation: string, callback: (targets: string[]) => void) => void
  getSources: (target: string, relation: string, callback: (sources: string[]) => void) => void
  getProperty: (subject: string, key: string, callback: (value: string) => void) => void
  getProperties: (subject: string, callback: (properties: Record<string, string>) => void) => void
  resolve: (source: string, path: string[], callback: (subject: string) => void) => void
  watch$: (source: string, path: string[]) => Observable<LocusWatch>
  path$: (name: NamedPath) => Observable<string>
  resolve$: (source: string, path: string[]) => Observable<string>
  pathProperty$: (name: NamedPath, key: string) => Observable<string>
  resolvedProperty$: (source: string, path: string[], key: string) => Observable<string>
  property$: (subject: string, key: string) => Observable<string>
  numberProperty$: (subject: string, key: string, fallback?: number) => Observable<number>
  booleanProperty$: (subject: string, key: string) => Observable<boolean>
  windowIcon$: (window: string) => Observable<string>
  sources$: (target: string, relation: string) => Observable<string[]>
  targets$: (source: string, relation: string) => Observable<string[]>
  workspace$: (id: number) => LocusWorkspace
  workspacesOnMonitor$: (monitor: Gdk.Monitor) => Observable<LocusWorkspace[]>
  activeWorkspace$: Observable<LocusWorkspace>
  activeWorkspaceForMonitor$: (monitor: Gdk.Monitor) => Observable<LocusWorkspace>
  setContextLink: (context: string, relation: string, target: string) => void
  clearContextLink: (context: string, relation: string) => void
}

const TRACE_DBUS_LATENCY = true

let service: LocusService | null = null
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

function contextSubject(context: string) {
  return `context:${context}`
}

function present(value: OptionalNodeId) {
  return value ?? ''
}

function firstProjectName(project: string, properties: Record<string, string>) {
  return properties.displayName
    || properties['display-name']
    || properties.title
    || properties.name
    || properties.path?.split('/').filter(Boolean).pop()
    || project
}

function toProject(subject: string, properties: Record<string, string>): LocusProject {
  return {
    subject,
    name: firstProjectName(subject, properties),
    icon: properties.icon || properties['icon-name'] || properties.symbolicIcon || 'folder_code',
    path: properties.path || '',
    properties,
  }
}

function callbackError(scope: string, error: unknown) {
  console.error(`[Locus] ${scope} failed:`, error)
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

  constructor(id: number, locus: LocusService) {
    super()
    this.wsId = id
    const subject = workspaceSubject(id)

    this.name = locus.property$(subject, 'name').pipe(shareReplay(1))
    this.active = locus.selectedWorkspace$.pipe(
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

    const selectedColumn$ = combineLatest([locus.selectedWindow$, this.active]).pipe(
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
                icon: locus.windowIcon$(tile.window),
                width: of(widthValue),
                height: of(heightValue),
                xValue,
                yValue,
                widthValue,
                heightValue,
                isActive: combineLatest([
                  selectedColumn$,
                  locus.selectedWindow$,
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

export function getLocusService(): LocusService {
  if (service) return service

  const client = new LocusDbusClient({ traceLatency: TRACE_DBUS_LATENCY })
  const pathCache = new Map<string, Observable<string>>()
  const watchCache = new Map<string, Observable<LocusWatch>>()
  const resolveCache = new Map<string, Observable<string>>()
  const resolvedPropertyCache = new Map<string, Observable<string>>()
  const propertyCache = new Map<string, Observable<string>>()
  const sourcesCache = new Map<string, Observable<string[]>>()
  const targetsCache = new Map<string, Observable<string[]>>()

  const path$ = (name: NamedPath) => {
    const cached = pathCache.get(name)
    if (cached) return cached
    const spec = schemaPath(name)
    const observable = resolve$(spec.from, spec.path)
    pathCache.set(name, observable)
    return observable
  }

  const watchKey = (source: string, path: string[]) => `${source}\0${path.join('\0')}`

  const watch$ = (source: string, path: string[]) => {
    const key = watchKey(source, path)
    const cached = watchCache.get(key)
    if (cached) return cached

    const observable = new Observable<LocusWatch>(subscriber => {
      let closed = false
      let watch: LocusWatch | null = null

      client.watchNode(source, path as Relation[])
        .then(created => {
          if (closed) {
            created.close().catch(error => callbackError('Watch.Close', error))
            return
          }
          watch = created
          subscriber.next(created)
        })
        .catch(error => subscriber.error(error))

      return () => {
        closed = true
        if (!watch) return
      }
    }).pipe(shareReplay(1))

    watchCache.set(key, observable)
    return observable
  }

  const resolve$ = (source: string, path: string[]) => {
    const key = watchKey(source, path)
    const cached = resolveCache.get(key)
    if (cached) return cached

    const observable = watch$(source, path).pipe(
      switchMap(watch => new Observable<string>(subscriber => {
        const unsubscribeTarget = watch.onTargetChanged(target => subscriber.next(present(target)))
        watch.target()
          .then(target => subscriber.next(present(target)))
          .catch(error => {
            callbackError('Watch.Target', error)
            subscriber.next('')
          })
        return () => unsubscribeTarget()
      })),
      catchError(error => {
        callbackError('WatchNode', error)
        return of('')
      }),
      distinctUntilChanged(),
      shareReplay(1),
    )

    resolveCache.set(key, observable)
    return observable
  }

  const resolvedProperty$ = (source: string, path: string[], key: string) => {
    const cacheKey = `${watchKey(source, path)}\0${key}`
    const cached = resolvedPropertyCache.get(cacheKey)
    if (cached) return cached

    const observable = watch$(source, path).pipe(
      switchMap(watch => new Observable<string>(subscriber => {
        const unsubscribeProperty = watch.onPropertyUpdated(key, value => subscriber.next(value))
        watch.property(key)
          .then(value => subscriber.next(value))
          .catch(error => {
            callbackError('Watch.Property', error)
            subscriber.next('')
          })
        return () => unsubscribeProperty()
      })),
      catchError(error => {
        callbackError('WatchNode', error)
        return of('')
      }),
      distinctUntilChanged(),
      shareReplay(1),
    )

    resolvedPropertyCache.set(cacheKey, observable)
    return observable
  }

  const pathProperty$ = (name: NamedPath, key: string) => {
    const spec = schemaPath(name)
    return resolvedProperty$(spec.from, spec.path, key)
  }

  const property$ = (subject: string, key: string) => {
    const cacheKey = `${subject}\0${key}`
    const cached = propertyCache.get(cacheKey)
    if (cached) return cached

    const observable = new Observable<string>(subscriber => {
      if (!subject) {
        subscriber.next('')
        return undefined
      }

      client.property(subject, key as PropertyKey)
        .then(value => subscriber.next(present(value)))
        .catch(error => {
          callbackError('GetProperty', error)
          subscriber.next('')
        })

      const unsubscribeChanged = client.onPropertyChanged(signal => {
        if (signal.subject === subject && signal.key === key) subscriber.next(signal.value)
      })
      const unsubscribeRemoved = client.onPropertyRemoved(signal => {
        if (signal.subject === subject && signal.key === key) subscriber.next('')
      })

      return () => {
        unsubscribeChanged()
        unsubscribeRemoved()
      }
    }).pipe(distinctUntilChanged(), shareReplay(1))

    propertyCache.set(cacheKey, observable)
    return observable
  }

  const sources$ = (target: string, relation: string) => {
    const cacheKey = `${target}\0${relation}`
    const cached = sourcesCache.get(cacheKey)
    if (cached) return cached

    const observable = new Observable<string[]>(subscriber => {
      const refresh = () => {
        client.sources(target, relation as Relation)
          .then(sources => subscriber.next(sources))
          .catch(error => {
            callbackError('GetSources', error)
            subscriber.next([])
          })
      }

      refresh()
      const unsubscribeAdded = client.onLinkAdded(signal => {
        if (signal.relation === relation && signal.target === target) refresh()
      })
      const unsubscribeRemoved = client.onLinkRemoved(signal => {
        if (signal.relation === relation && signal.target === target) refresh()
      })
      const unsubscribeSet = client.onLinkSet(signal => {
        if (signal.relation === relation && (signal.target === target || signal.oldTargets.includes(target))) refresh()
      })

      return () => {
        unsubscribeAdded()
        unsubscribeRemoved()
        unsubscribeSet()
      }
    }).pipe(shareReplay(1))

    sourcesCache.set(cacheKey, observable)
    return observable
  }

  const targets$ = (source: string, relation: string) => {
    const cacheKey = `${source}\0${relation}`
    const cached = targetsCache.get(cacheKey)
    if (cached) return cached

    const observable = new Observable<string[]>(subscriber => {
      const refresh = () => {
        client.targets(source, relation as Relation)
          .then(targets => subscriber.next(targets))
          .catch(error => {
            callbackError('GetTargets', error)
            subscriber.next([])
          })
      }

      refresh()
      const unsubscribeAdded = client.onLinkAdded(signal => {
        if (signal.relation === relation && signal.source === source) refresh()
      })
      const unsubscribeRemoved = client.onLinkRemoved(signal => {
        if (signal.relation === relation && signal.source === source) refresh()
      })
      const unsubscribeSet = client.onLinkSet(signal => {
        if (signal.relation === relation && signal.source === source) refresh()
      })

      return () => {
        unsubscribeAdded()
        unsubscribeRemoved()
        unsubscribeSet()
      }
    }).pipe(shareReplay(1))

    targetsCache.set(cacheKey, observable)
    return observable
  }

  const activeProject$ = new BehaviorSubject<LocusProject | null>(null)
  const setActiveProject = (project: string) => {
    if (!project) {
      activeProject$.next(null)
      return
    }

    client.properties(project)
      .then(properties => activeProject$.next(toProject(project, properties)))
      .catch(error => {
        callbackError('GetProperties', error)
        activeProject$.next(null)
      })
  }

  const refreshActiveProject = () => {
    client.resolvePath('selected-project')
      .then(project => setActiveProject(present(project)))
      .catch(error => {
        callbackError('ResolvePath(selected-project)', error)
        setActiveProject('')
      })
  }

  const numberProperty$ = (subject: string, key: string, fallback = 0) =>
    property$(subject, key).pipe(
      map(value => {
        const number = Number(value)
        return Number.isFinite(number) ? number : fallback
      }),
      distinctUntilChanged(),
      shareReplay(1),
    )

  const booleanProperty$ = (subject: string, key: string) =>
    property$(subject, key).pipe(
      map(value => value === 'true'),
      distinctUntilChanged(),
      shareReplay(1),
    )

  const standardWindowIcon$ = (window: string) =>
    property$(window, 'app-id').pipe(
      map(getIconForAppId),
      distinctUntilChanged(),
    )

  const windowIcon$ = (window: string) =>
    targets$(window, 'app-instance').pipe(
      switchMap(targets => {
        const appInstance = targets[0]
        if (!appInstance) return standardWindowIcon$(window)

        return property$(appInstance, 'icon').pipe(
          switchMap(icon => icon ? of(icon) : standardWindowIcon$(window)),
        )
      }),
      distinctUntilChanged(),
      shareReplay(1),
    )

  const workspace$ = (id: number) => {
    if (!workspaces.has(id)) workspaces.set(id, new LocusWorkspace(id, service!))
    return workspaces.get(id)!
  }

  const selectedWorkspace$ = path$('selected-workspace')
  const selectedWindow$ = path$('selected-window')
  const selectedAgentSession$ = path$('selected-agent-session')
  const selectedAgentSessionId$ = selectedAgentSession$.pipe(
    map(subject => subject.startsWith('agent-session:')
      ? subject.slice('agent-session:'.length)
      : ''),
    distinctUntilChanged(),
    shareReplay(1),
  )
  const selectedOutput$ = path$('selected-output')
  const selectedWindowTitle$ = pathProperty$('selected-window', 'title').pipe(shareReplay(1))
  const selectedWindowAppId$ = pathProperty$('selected-window', 'app-id').pipe(shareReplay(1))
  const selectedWindowIcon$ = selectedWindow$.pipe(
    switchMap(window => windowIcon$(window)),
    distinctUntilChanged(),
    shareReplay(1),
  )
  const monitors$ = new BehaviorSubject<Gdk.Monitor[]>(monitors()).pipe(shareReplay(1))
  const activeMonitor$ = pathProperty$('selected-output', 'connector').pipe(
    distinctUntilChanged(),
    map(monitorByConnector),
    filter(monitor => monitor != null),
    distinctUntilChanged(),
    shareReplay(1),
  )
  const activeWorkspace$ = selectedWorkspace$.pipe(
    map(workspaceId),
    filter(id => id > 0),
    map(workspace$),
    shareReplay(1),
  )
  const workspacesOnMonitor$ = (monitor: Gdk.Monitor) => sources$(`output:${monitor.connector}`, 'output').pipe(
    map(subjects => subjects.filter(subject => subject.startsWith('workspace:'))),
    map(subjects => subjects.sort((left, right) => workspaceId(left) - workspaceId(right))),
    distinctUntilChanged(sameArray),
    map(subjects => subjects.map(subject => workspace$(workspaceId(subject)))),
    shareReplay(1),
  )
  const activeWorkspaceForMonitor$ = (monitor: Gdk.Monitor) => combineLatest([
    selectedWorkspace$,
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

  service = {
    activeProject$,
    selectedWorkspace$,
    selectedWindow$,
    selectedAgentSession$,
    selectedAgentSessionId$,
    selectedOutput$,
    selectedWindowTitle$,
    selectedWindowAppId$,
    selectedWindowIcon$,
    monitors$,
    activeMonitor$,
    refreshActiveProject,
    getTargets(source, relation, callback) {
      client.targets(source, relation as Relation)
        .then(callback)
        .catch(error => {
          callbackError('GetTargets', error)
          callback([])
        })
    },
    getSources(target, relation, callback) {
      client.sources(target, relation as Relation)
        .then(callback)
        .catch(error => {
          callbackError('GetSources', error)
          callback([])
        })
    },
    getProperty(subject, key, callback) {
      client.property(subject, key as PropertyKey)
        .then(value => callback(present(value)))
        .catch(error => {
          callbackError('GetProperty', error)
          callback('')
        })
    },
    getProperties(subject, callback) {
      client.properties(subject)
        .then(callback)
        .catch(error => {
          callbackError('GetProperties', error)
          callback({})
        })
    },
    resolve(source, path, callback) {
      client.resolve(source, path as Relation[])
        .then(target => callback(present(target)))
        .catch(error => {
          callbackError('Resolve', error)
          callback('')
        })
    },
    watch$,
    path$,
    resolve$,
    pathProperty$,
    resolvedProperty$,
    property$,
    numberProperty$,
    booleanProperty$,
    windowIcon$,
    sources$,
    targets$,
    workspace$,
    workspacesOnMonitor$,
    activeWorkspace$,
    activeWorkspaceForMonitor$,
    setContextLink(context, relation, target) {
      client.setLink(contextSubject(context), relation as Relation, target)
        .catch(error => callbackError('SetLink', error))
    },
    clearContextLink(context, relation) {
      client.removeLinks(contextSubject(context), relation as Relation)
        .catch(error => callbackError('RemoveLinks', error))
    },
  }

  path$('selected-project').subscribe(setActiveProject)

  return service
}
