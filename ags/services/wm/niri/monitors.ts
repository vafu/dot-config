import { MonitorService } from '../types'
import { Gdk, App } from 'astal/gtk4'
import { Observable, filter, map, mergeWith, retry, take } from 'rxjs'
import { fromConnectable } from 'rxbinding'
import AstalNiri from 'gi://AstalNiri?version=0.1'
import { logNext } from 'commons/rx'

const niri = AstalNiri.get_default()
//
export const mapToMonitor = (o: AstalNiri.Output | null) =>
  o == null
    ? null
    : App.get_monitors().find(m => {
        return m.connector == o.name
      })

const monitors: Observable<Gdk.Monitor[]> = fromConnectable(
  niri,
  'outputs',
).pipe(
  map(outputs =>
    outputs
      .filter(o => o != null)
      .map(mapToMonitor)
      .filter(m => m != null),
  ),
  retry({
    count: 2,
    delay: 1000,
  }),
)
const activeMonitor = fromConnectable(niri, 'focused_output').pipe(
  map(mapToMonitor),
  // FIXME: Niri (?) doesn't output focused monitor when only one connected
  mergeWith(
    monitors.pipe(
      filter(a => a.length > 0),
      map(a => a[0]),
      take(1),
    ),
  ),
)

export const niriMonitorService: MonitorService = {
  monitors: monitors,
  activeMonitor: activeMonitor,
}
