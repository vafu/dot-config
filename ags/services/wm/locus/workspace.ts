import GObject from 'gi://GObject?version=2.0'
import Gdk from 'gi://Gdk?version=4.0'
import { combineLatest, distinctUntilChanged, filter, map, Observable, of, shareReplay, switchMap } from 'rxjs'
import { getLocusService } from 'services/locus'
import { Tab, Window, Workspace, WorkspaceService } from '../types'
import { booleanProperty$, numberProperty$, property$, workspaceId, workspaceSubject } from './common'
import { windowFromSubject } from './window'

function sameArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
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
          map(selected => workspaces.find(workspace => workspace.wsId === workspaceId(selected)) ?? workspaces[0]),
        ),
      ),
      filter(workspace => workspace != null),
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

    this.tabs = windowSubjects$.pipe(
      map(subjects =>
        subjects
          .map(window => ({
            window,
            column: Number.NaN,
          }))
          .map(item => ({
            ...item,
            column$: numberProperty$(item.window, 'column', 0),
          })),
      ),
      switchMap(items => {
        if (items.length === 0) return of([])
        return combineLatest(items.map(item => item.column$.pipe(map(column => ({ ...item, column })))))
      }),
      map(items =>
        items
          .sort((left, right) => left.column - right.column)
          .map(item => {
            const win = windowFromSubject(item.window)
            return {
              workspace: this,
              title: win.title,
              icon: win.icon,
              width: numberProperty$(item.window, 'tile-width', 1).pipe(map(width => Math.max(0.05, Math.min(1, width / 1920)))),
              isActive: locus.selectedWindow$.pipe(
                map(selected => selected === item.window),
                distinctUntilChanged(),
              ),
            } as Tab
          }),
      ),
      shareReplay(1),
    )

    this.selectedTab = this.tabs.pipe(
      map(tabs => tabs.find(Boolean)),
      filter(tab => tab != null),
      shareReplay(1),
    )

    this.viewportOffset = of(0)
  }

  switchToTab(_idx: number, _move: boolean): void {
    throw new Error('Tab switching is not implemented through Locus yet')
  }
}

export const locusWorkspaceService: WorkspaceService = new LocusWorkspaceService()
