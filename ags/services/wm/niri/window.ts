import AstalApps from 'gi://AstalApps?version=0.1'
import { Tab, Window, WindowService } from '../types'
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
import app from 'astal/gtk4/app'

const niri = AstalNiri.get_default()
const apps = AstalApps.Apps.new()

const focusedClient = fromConnectable(niri, 'focused_window')

const emptyWindow: Window = {
  id: '0x0',
  cls: of(''),
  title: of(''),
  tab: empty(),
  icon: empty(),
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

export const clientToWindow = (c: AstalNiri.Window) =>
  ({
    id: c.id.toString(),
    cls: fromConnectable(c, 'appId'),
    title: fromConnectable(c, 'title'),
    tab: EMPTY as Observable<Tab>,
    icon: fromConnectable(c, 'appId').pipe(
      map(w => {
        const res = apps.list.find(a =>
          a.entry.toLowerCase().includes(w.toLowerCase())
        )
        if (!!res) {
          return res.iconName
        } else {
          return ''
        }
      }),
    ),
  }) as Window

const getFor = (wsId: number) =>
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
