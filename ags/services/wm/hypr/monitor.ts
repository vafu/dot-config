import AstalHyprland from 'gi://AstalHyprland?version=0.1'
import { MonitorService } from '../types'
import { Gdk } from 'ags/gtk4'
import { app } from 'ags/gtk4/app'
import { Observable, map, retry } from 'rxjs'
import { fromConnectable } from 'rxbinding'

const hypr = AstalHyprland.get_default()

export const mapToMonitor = (am: AstalHyprland.Monitor) =>
  app.get_monitors().find(
    (m) =>
      m.description.startsWith(am.description) ||
      am.description.startsWith(m.description)
  )

const monitors: Observable<Gdk.Monitor[]> = fromConnectable(
  hypr,
  'monitors'
).pipe(
  map((monitors) => monitors.filter(m => m != null).map(mapToMonitor)),
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
