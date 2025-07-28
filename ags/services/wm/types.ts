import { Gdk } from 'astal/gtk4'
import { Observable } from 'rxjs'

export interface WindowService {
  active: ActiveWindow
}

export interface ActiveWindow {
  cls: Observable<string>
  title: Observable<string>
}

export interface WorkspaceService {
  getWorkspace(idx: number): Workspace
  activeWorkspace: Observable<Workspace>

  switchToWs(idx: number, move: boolean): void
}

export interface Tab {
  id: number
  title: string
}

export interface Workspace {
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
