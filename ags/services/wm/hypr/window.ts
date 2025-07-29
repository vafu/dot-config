import { Window, WindowService } from '../types'
import AstalHyprland from 'gi://AstalHyprland?version=0.1'
import { fromConnectable } from 'rxbinding'
import { distinctUntilChanged, empty, map, of, shareReplay } from 'rxjs'
import { getBackingTab } from './workspace'

const hypr = AstalHyprland.get_default()

const focusedClient = fromConnectable(hypr, 'focusedClient')

const emptyWindow: Window = {
  id: "0x0",
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

const clientToWindow = (c: AstalHyprland.Client) =>
  ({
    id: c.address,
    cls: fromConnectable(c, 'class'),
    title: fromConnectable(c, 'title'),
    tab: fromConnectable(c, 'workspace').pipe(map(ws => getBackingTab(ws))),
  }) as Window

const getFor = (wsId: number, tabId: number) =>
  fromConnectable(hypr, 'clients').pipe(
    map(all =>
      all
        .filter(c => {
          const tab = getBackingTab(c.workspace)
          return tab.tabId == tabId && tab.workspace.wsId == wsId
        })
        .map(clientToWindow),
    ),
    distinctUntilChanged(),
    shareReplay(),
  )

export const windowService: WindowService = {
  active: activeWindow,
  getFor: getFor,
}
