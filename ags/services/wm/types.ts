import GObject from 'gi://GObject?version=2.0'
import Gdk from 'gi://Gdk?version=4.0'
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
  icon: Observable<string>
}

export interface WorkspaceService {
  activeWorkspace: Observable<Workspace>

  getWorkspace(idx: number): Workspace
  activeWorkspaceFor(monitor: Gdk.Monitor): Observable<Workspace>
  workspacesOn(monitor: Gdk.Monitor): Observable<Workspace[]>

  switchToWs(idx: number, move: boolean): void
}

export interface Tab {
  workspace: Workspace
  title: Observable<string>
  icon: Observable<string>
  width: Observable<number> // Relative width (0-1 range, fraction of monitor width)
  isActive: Observable<boolean> // Whether this tab is the selected tab in its workspace
}

export interface Workspace extends GObject.Object {
  wsId: number
  name: Observable<string>
  tabs: Observable<Tab[]>
  selectedTab: Observable<Tab>

  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean>

  switchToTab(idx: number, move: boolean): void

  activeWindow: Observable<Window>
  viewportOffset: Observable<number> // Horizontal scroll position (relative, 0-1 range)
}

export interface MonitorService {
  monitors: Observable<Gdk.Monitor[]>
  activeMonitor: Observable<Gdk.Monitor>
}


