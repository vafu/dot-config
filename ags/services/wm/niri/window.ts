import AstalApps from 'gi://AstalApps?version=0.1'
import { Tab, Window, WindowService } from '../types'
import AstalNiri from 'gi://AstalNiri?version=0.1'
import { fromConnectable } from 'rxbinding'
import {
  distinctUntilChanged,
  EMPTY,
  empty,
  map,
  merge,
  mergeWith,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs'
import app from 'ags/gtk4/app'
import GLib from 'gi://GLib?version=2.0'

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
const iconNameCache = new Map<string, string>

const APP_TITLE_ICON_OVERRIDES = [
  { prefix: "- Nvim", icon: `${GLib.get_user_config_dir()}/ags/assets/icons/Neovim.svg` }
]

function getIconForAppId(appId: string): string {
  let icon = iconNameCache.get(appId)
  if (!icon) {
    const res = apps.list.find(a =>
      a.entry.toLowerCase().includes(appId.toLowerCase())
    )
    if (!!res) {
      icon = res.iconName
      iconNameCache.set(appId, icon)
    } else {
      return ''
    }
  }

  return icon
}

function iconFor(c: AstalNiri.Window): Observable<string> {
  return fromConnectable(c, "title").pipe(
    switchMap((t: string) => {
      const override = APP_TITLE_ICON_OVERRIDES.find((o) => t.includes(o.prefix))
      return !!override ? of(override.icon) : fromConnectable(c, "appId").pipe(
        map(getIconForAppId)
      )
    })
  )
}

export const clientToWindow = (c: AstalNiri.Window) =>
  ({
    id: c.id.toString(),
    cls: fromConnectable(c, 'appId'),
    title: fromConnectable(c, 'title'),
    tab: EMPTY as Observable<Tab>,
    icon: iconFor(c)
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

