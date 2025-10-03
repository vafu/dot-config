import AstalHyprland from 'gi://AstalHyprland?version=0.1'
import { fromConnectable } from 'rxbinding'
import {
  Observable,
  map,
  distinctUntilChanged,
  of,
  shareReplay,
  filter,
  switchMap,
  take,
  startWith,
  combineLatest,
  scan,
} from 'rxjs'
import { WorkspaceService, Workspace, Tab, Window } from '../types'
import obtainWmService from 'services'
import { Gdk } from 'astal/gtk4'
import { mapToMonitor } from './monitor'

const hypr = AstalHyprland.get_default()
const focusedWorkspace = fromConnectable(hypr, 'focusedWorkspace')
const workspaces = fromConnectable(hypr, 'workspaces')

const urgentWs = new Observable<number>(o => {
  const id = hypr.connect('urgent', (s, id) => {
    const wsid = s.get_workspaces().find(w => w.get_last_client() === id)?.id
    o.next(wsid)
  })
  return () => hypr.disconnect(id)
})

class HyprWorkspaceService implements WorkspaceService {

  activeWorkspaceFor(monitor: Gdk.Monitor): Observable<Workspace> {
    // TODO: architecture is meh
    return focusedWorkspace.pipe(
      // TODO handle case when ws moves to different monitor
      filter(ws => mapToMonitor(ws.monitor) == monitor),
      map(ws => this.getWorkspace(getWsId(ws))),
      distinctUntilChanged(),
    )
  }

  private _workspaces: Map<number, HyprWS> = new Map()

  getWorkspace = (int: number) => {
    if (!this._workspaces.get(int)) {
      const ws = new HyprWS(int)
      this._workspaces.set(int, ws)
    }
    return this._workspaces.get(int)!
  }

  activeWorkspace: Observable<Workspace> = focusedWorkspace.pipe(
    map(ws => this.getWorkspace(getWsId(ws))),
    distinctUntilChanged(),
  )

  switchToWs(idx: number, move: boolean) {
    this.getWorkspace(idx).focus(move)
  }
}

export function getBackingTab(ws: AstalHyprland.Workspace) {
  return (workspaceService.getWorkspace(getWsId(ws)) as HyprWS).getTab(
    getTabId(ws),
  )
}

function getWsId(ws: AstalHyprland.Workspace) {
  return ws.id % 10
}

function getTabId(ws: AstalHyprland.Workspace) {
  return Math.floor(ws.id / 10)
}

class HyprWS implements Workspace {
  _tabs = new Map<number, Tab>()
  tabs: Observable<Tab[]>
  selectedTab: Observable<Tab>

  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean> = of(false)
  wsId: number

  private _selectedTab = 0

  hyprWsId() {
    return this._selectedTab * 10 + this.wsId
  }

  focus(move: boolean) {
    const cmd = move ? 'movetoworkspace' : 'workspace'
    const target = this.hyprWsId()
    hypr.dispatch(cmd, target.toString())
  }

  switchToTab(idx: number, move: boolean) {
    this._selectedTab = idx
    this.focus(move)
  }

  constructor(id: number) {
    this.wsId = id
    this.tabs = workspaces.pipe(
      map(w =>
        w
          .filter(ws => getWsId(ws) == id)
          .map(ws => getBackingTab(ws))
          .sort((p, c) => p.tabId - c.tabId),
      ),
      distinctUntilChanged(),
      shareReplay(1),
    )

    this.selectedTab = focusedWorkspace.pipe(
      filter(w => getWsId(w) == id),
      map(w => {
        const tab = this.getTab(getTabId(w))
        this._selectedTab = tab.tabId
        return getBackingTab(w)
      }),
      startWith(this.getTab(0)),
      shareReplay(1),
    )

    this.active = focusedWorkspace.pipe(
      map(w => getWsId(w) == id),
      distinctUntilChanged(),
      shareReplay(1),
    )

    this.occupied = workspaces.pipe(
      map(w => w.filter(ws => getWsId(ws) === id && ws.clients.length > 0)),
      distinctUntilChanged(),
      map(ws => ws.length > 0),
      shareReplay(1),
    )

    this.urgent = urgentWs.pipe(
      filter(wsId => wsId && wsId % 10 === id),
      switchMap(() =>
        this.active.pipe(
          filter(active => active),
          map(active => !active),
          take(1),
          startWith(true),
        ),
      ),
      startWith(false),
    )
  }

  getTab(tabId: number) {
    if (!this._tabs.get(tabId)) {
      const tab = {
        tabId: tabId,
        title: getTitleFor(tabId, this.wsId),
        workspace: this,
      } as Tab
      this._tabs.set(tabId, tab)
    }
    return this._tabs.get(tabId)
  }
}

function getTitleFor(tabId: number, wsId: number) {
  const windows = obtainWmService('window')

  const activeWindowState = windows.active.pipe(
    switchMap(activeWindow => {
      return activeWindow.tab.pipe(map(tab => ({ window: activeWindow, tab })))
    }),
  )

  const lastFocusedWindow = activeWindowState.pipe(
    scan(
      (previouslyRememberedWindow, currentEvent) => {
        const { window: currentWindow, tab: currentTab } = currentEvent

        if (
          currentWindow &&
          currentTab &&
          currentTab.workspace.wsId === wsId &&
          currentTab.tabId === tabId
        ) {
          return currentWindow
        }

        if (
          previouslyRememberedWindow &&
          currentWindow?.id === previouslyRememberedWindow?.id
        ) {
          return null
        }

        return previouslyRememberedWindow
      },
      null as Window | null,
    ),
    distinctUntilChanged(),
  )

  return lastFocusedWindow.pipe(
    switchMap(rememberedWindow => {
      if (rememberedWindow) {
        return rememberedWindow.title
      }

      return windows.getFor(wsId, tabId).pipe(
        take(1),
        switchMap(windowList => {
          if (windowList.length > 0) {
            return windowList[0].title
          }
          return of(`${tabId + 1}`)
        }),
      )
    }),
    startWith(`#${tabId + 1}`),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
}

export const workspaceService: WorkspaceService = new HyprWorkspaceService()
