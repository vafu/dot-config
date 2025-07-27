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
  activeWorkroom: Observable<WR>
}

export interface WR {
  getWs(idx: number): WS
}

export interface WS {
  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean>
}

export interface MonitorService {
  monitors: Observable<Gdk.Monitor[]>
  activeMonitor: Observable<Gdk.Monitor>
}
