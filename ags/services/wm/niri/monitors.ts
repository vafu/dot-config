import { MonitorService } from '../types'
import App from 'ags/gtk4/app'
import Gdk from 'gi://Gdk?version=4.0'
import {
  Observable,
  distinctUntilChanged,
  filter,
  map,
  retry,
  switchMap,
} from 'rxjs'
import { fromConnectable } from 'rxbinding'
import AstalNiri from 'gi://AstalNiri?version=0.1'
import { createBinding } from 'gnim'

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

createBinding(niri, "focused_workspace")
const activeMonitor = fromConnectable(niri, 'focused_workspace').pipe(
  map(w => w.output),
  distinctUntilChanged(),
  switchMap(co =>
    fromConnectable(niri, 'outputs').pipe(map(a => a.find(o => o.name == co))),
  ),
  map(mapToMonitor),
  filter(m => m != null),
)

export const niriMonitorService: MonitorService = {
  monitors: monitors,
  activeMonitor: activeMonitor,
}
