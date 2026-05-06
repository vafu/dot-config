import { distinctUntilChanged, Observable, shareReplay } from 'rxjs'
import { getLocusService } from 'services/locus'

export function property$(subject: string, key: string) {
  return getLocusService().property$(subject, key)
}

export function numberProperty$(subject: string, key: string, fallback = 0) {
  return new Observable<number>(subscriber => {
    const sub = property$(subject, key).subscribe(value => {
      const number = Number(value)
      subscriber.next(Number.isFinite(number) ? number : fallback)
    })
    return () => sub.unsubscribe()
  }).pipe(distinctUntilChanged(), shareReplay(1))
}

export function booleanProperty$(subject: string, key: string) {
  return new Observable<boolean>(subscriber => {
    const sub = property$(subject, key).subscribe(value => {
      subscriber.next(value === 'true')
    })
    return () => sub.unsubscribe()
  }).pipe(distinctUntilChanged(), shareReplay(1))
}

export function workspaceSubject(id: number) {
  return `workspace:${id}`
}

export function workspaceId(subject: string) {
  return Number(subject.replace(/^workspace:/, '')) || 0
}
