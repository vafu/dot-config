import { ActiveWindow, WindowService } from '../types'
import AstalHyprland from 'gi://AstalHyprland?version=0.1'
import { fromConnectable } from 'rxbinding'
import { of, switchMap } from 'rxjs'

const hypr = AstalHyprland.get_default()

const focusedClient = fromConnectable(hypr, 'focusedClient')

const activeWindow: ActiveWindow = {
  cls: focusedClient.pipe(
    switchMap((c) => (c == null ? of('') : fromConnectable(c, 'class')))
  ),
  title: focusedClient.pipe(
    switchMap((c) => (c == null ? of('') : fromConnectable(c, 'title')))
  ),
}

export const windowService: WindowService = {
  active: activeWindow,
}
