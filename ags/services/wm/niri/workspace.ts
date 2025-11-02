import { Gdk } from 'astal/gtk4'
import { EMPTY, Observable } from 'rxjs'
import { Tab, Workspace, WorkspaceService } from '../types'

class NiriWorkspaceService implements WorkspaceService {
  activeWorkspace: Observable<Workspace>
  getWorkspace(idx: number): Workspace {
    throw new Error('Method not implemented.')
  }
  activeWorkspaceFor(monitor: Gdk.Monitor): Observable<Workspace> {
    throw new Error('Method not implemented.')
  }
  workspacesOn(monitor: Gdk.Monitor): Observable<Workspace[]> {
    throw new Error('Method not implemented.')
  }
  switchToWs(idx: number, move: boolean): void {
    throw new Error('Method not implemented.')
  }
}

class NiriWorkspace implements Workspace {
  wsId: number
  tabs: Observable<Tab[]>
  selectedTab: Observable<Tab>
  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean>

  constructor(id: number) {
    this.wsId = id
    this.tabs = EMPTY
    this.selectedTab = EMPTY
    this.active = 
  }

  switchToTab(idx: number, move: boolean): void {
    throw new Error('Not supported in niri')
  }
}

export const workspaceService = new NiriWorkspaceService()
