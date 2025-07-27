import AstalHyprland from 'gi://AstalHyprland?version=0.1'
import { MonitorService } from '../types'
import { Gdk, App, Astal } from 'astal/gtk4'
import { Observable, OperatorFunction, map, retry } from 'rxjs'
import { fromConnectable } from 'rxbinding'

const hypr = AstalHyprland.get_default()

const mapToMonitor = (am: AstalHyprland.Monitor) =>
  App.get_monitors().find(
    (m) =>
      m.description.startsWith(am.description) ||
      am.description.startsWith(m.description)
  )

const monitors: Observable<Gdk.Monitor[]> = fromConnectable(
  hypr,
  'monitors'
).pipe(
  map((monitors) => monitors.map(mapToMonitor)),
  retry({
    count: 2,
    delay: 1000,
  })
)
const activeMonitor = fromConnectable(hypr, 'focusedMonitor').pipe(
  map(mapToMonitor)
)

export const monitorService: MonitorService = {
  monitors: monitors,
  activeMonitor: activeMonitor,
}
