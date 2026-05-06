import app from 'ags/gtk4/app'
import Gdk from 'gi://Gdk?version=4.0'
import { BehaviorSubject, distinctUntilChanged, map, of, shareReplay, switchMap } from 'rxjs'
import { getLocusService } from 'services/locus'
import { MonitorService } from '../types'
import { property$ } from './common'

function monitors() {
  return app.get_monitors().filter((monitor): monitor is Gdk.Monitor => monitor != null)
}

function monitorByConnector(connector: string) {
  return monitors().find(monitor => monitor.connector === connector) ?? monitors()[0]
}

const monitors$ = new BehaviorSubject<Gdk.Monitor[]>(monitors())

const locus = getLocusService()

const activeConnector$ = locus.path$('selected-output').pipe(
  distinctUntilChanged(),
  switchMap(output => output ? property$(output, 'connector') : of('')),
  distinctUntilChanged(),
  shareReplay({ bufferSize: 1, refCount: true }),
)

export const locusMonitorService: MonitorService = {
  monitors: monitors$.pipe(shareReplay(1)),
  activeMonitor: activeConnector$.pipe(
    map(connector => monitorByConnector(connector)),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  ),
}
