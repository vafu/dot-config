import { Observable } from 'rxjs'

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

export interface WindowService {
  active: ActiveWindow
}

export interface ActiveWindow {
  cls: Observable<string>
  title: Observable<string>
}
