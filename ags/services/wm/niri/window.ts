import { Tab, Window, WindowService } from '../types'
import AstalHyprland from 'gi://AstalHyprland?version=0.1'
import AstalNiri from 'gi://AstalNiri?version=0.1'
import { fromConnectable } from 'rxbinding'
import {
  distinctUntilChanged,
  EMPTY,
  empty,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs'

const niri = AstalNiri.get_default()

const focusedClient = fromConnectable(niri, 'focused_window')

const emptyWindow: Window = {
  id: '0x0',
  cls: of(''),
  title: of(''),
  tab: empty(),
}

const activeWindow = focusedClient.pipe(
  map(c => {
    if (c == null) {
      return emptyWindow
    } else {
      return clientToWindow(c)
    }
  }),
)

const clientToWindow = (c: AstalNiri.Window) =>
  ({
    id: c.id.toString(),
    cls: fromConnectable(c, 'appId'),
    title: fromConnectable(c, 'title'),
    tab: EMPTY as Observable<Tab>,
  }) as Window

const getFor = (wsId: number, tabId: number) =>
  fromConnectable(niri, 'workspaces').pipe(
    map(all => all.find(w => w.idx == wsId)),
    switchMap(w => fromConnectable(w, 'windows')),
    map(a => a.map(clientToWindow)),
    distinctUntilChanged(),
    shareReplay(1),
  )

export const windowService: WindowService = {
  active: activeWindow,
  getFor: getFor,
}
