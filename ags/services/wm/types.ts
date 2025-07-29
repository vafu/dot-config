import { Gdk } from 'astal/gtk4'
import { Observable } from 'rxjs'

export interface WindowService {
  active: Observable<Window>
  getFor(wsId: number, tabId: number): Observable<Window[]>
}

export interface Window {
  id: string
  cls: Observable<string>
  title: Observable<string>
  tab: Observable<Tab>
}

export interface WorkspaceService {
  getWorkspace(idx: number): Workspace
  activeWorkspace: Observable<Workspace>

  switchToWs(idx: number, move: boolean): void
}

export interface Tab {
  tabId: number
  workspace: Workspace
  title: Observable<string>
}

export interface Workspace {
  wsId: number
  tabs: Observable<Tab[]>
  selectedTab: Observable<Tab>

  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean>

  switchToTab(idx: number, move: boolean): void
}

export interface MonitorService {
  monitors: Observable<Gdk.Monitor[]>
  activeMonitor: Observable<Gdk.Monitor>
}
