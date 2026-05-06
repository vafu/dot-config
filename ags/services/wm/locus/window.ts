import AstalApps from 'gi://AstalApps?version=0.1'
import GLib from 'gi://GLib?version=2.0'
import { distinctUntilChanged, EMPTY, map, Observable, of, shareReplay, switchMap } from 'rxjs'
import { getLocusService } from 'services/locus'
import { Tab, Window, WindowService } from '../types'
import { property$ } from './common'

const apps = AstalApps.Apps.new()
const iconNameCache = new Map<string, string>()

const emptyWindow: Window = {
  id: '',
  cls: of(''),
  title: of(''),
  tab: EMPTY as Observable<Tab>,
  icon: of(''),
}

const APP_TITLE_ICON_OVERRIDES = [
  { prefix: '- Nvim', icon: `${GLib.get_user_config_dir()}/ags/assets/icons/Neovim.svg` },
]

function getIconForAppId(appId: string): string {
  let icon = iconNameCache.get(appId)
  if (!icon) {
    const app = apps.list.find(a => a.entry.toLowerCase().includes(appId.toLowerCase()))
    if (!app) return ''
    icon = app.iconName
    iconNameCache.set(appId, icon)
  }
  return icon
}

export function windowFromSubject(subject: string): Window {
  if (!subject) return emptyWindow

  const title = property$(subject, 'title')
  const cls = property$(subject, 'app-id')
  const icon = title.pipe(
    switchMap(title => {
      const override = APP_TITLE_ICON_OVERRIDES.find(o => title.includes(o.prefix))
      return override ? of(override.icon) : cls.pipe(map(getIconForAppId))
    }),
    distinctUntilChanged(),
    shareReplay(1),
  )

  return {
    id: subject.replace(/^window:/, ''),
    cls,
    title,
    tab: EMPTY as Observable<Tab>,
    icon,
  }
}

export const locusWindowService: WindowService = {
  active: getLocusService().selectedWindow$.pipe(
    map(windowFromSubject),
    shareReplay(1),
  ),
  getFor: wsId =>
    new Observable<Window[]>(subscriber => {
      const locus = getLocusService()
      const sub = locus.sources$(`workspace:${wsId}`, 'workspace').subscribe(sources => {
        subscriber.next(sources.filter(s => s.startsWith('window:')).map(windowFromSubject))
      })
      return () => sub.unsubscribe()
    }).pipe(shareReplay(1)),
}
