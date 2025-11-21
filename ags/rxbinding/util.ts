import Gio from 'gi://Gio?version=2.0'
import { monitorFile, readFileAsync } from 'ags/file'
import { subprocess } from 'ags/process'
import {
    defer,
    EMPTY,
    filter,
    merge,
    Observable,
    switchMap,
} from 'rxjs'
import { fromPromise } from 'rxjs/internal/observable/innerFrom'

export function fromFileMonitor(
    path: string
): Observable<Gio.FileMonitorEvent> {
    return new Observable((o) => {
        const monitor = monitorFile(path, (f, e) => o.next(e))
        return () => monitor.cancel()
    })
}

export function fromFile(path: string): Observable<string> {
    return merge(
        fromFileMonitor(path).pipe(
            filter(
                (e) =>
                    e == Gio.FileMonitorEvent.CHANGED || e == Gio.FileMonitorEvent.CREATED
            ),
            switchMap(() => fromPromise(readFileAsync(path)))
        ),
        defer(() => {
            if (Gio.file_new_for_path(path).query_exists(null))
                return fromPromise(readFileAsync(path))
            else {
                return EMPTY
            }
        })
    )
}

export function fromJsonProcess<T>(command: string): Observable<T> {
    return new Observable(e => {
        subprocess(command,
            out => e.next(JSON.parse(out) as T)
        )
    })
}
