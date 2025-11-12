import { logNext } from 'commons/rx'
import {
  Observable,
  EMPTY,
  map,
  filter,
  shareReplay,
  distinctUntilChanged,
  switchMap,
  combineLatest,
} from 'rxjs'
import { Workspace, Tab } from '../types'
import { workspaces, focusedWs, windows } from './workspace'

export class NiriWorkspace implements Workspace {
  wsId: number
  tabs: Observable<Tab[]>
  selectedTab: Observable<Tab>
  active: Observable<boolean>
  occupied: Observable<boolean>
  urgent: Observable<boolean>

  constructor(idx: number) {
    this.wsId = idx
    this.tabs = EMPTY
    this.selectedTab = EMPTY
    const thisWs = workspaces.pipe(
      map(a => a.find(w => w.idx == idx)),
      filter(w => w != null),
      shareReplay(1),
    )
    this.active = focusedWs.pipe(
      map(w => w.idx == idx),
      distinctUntilChanged(),
      shareReplay(1),
    )
    this.occupied = thisWs.pipe(
      switchMap(w => combineLatest(of(w), windows)),
      logNext(w => `wow, this ws ${w}`),
      map(w => w.windows.length > 0),
    )
    this.urgent = thisWs.pipe(map(w => w.isUrgent))
  }

  switchToTab(idx: number, move: boolean): void {
    throw new Error('Not supported in niri')
  }
}
