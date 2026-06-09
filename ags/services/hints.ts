import { BehaviorSubject, distinctUntilChanged } from 'rxjs'
import { requestsFor } from 'services/requests'

type HintsRequest = {
  command: 'hints'
  active?: boolean
}

const active = new BehaviorSubject(false)

export const hintsMode$ = active.pipe(distinctUntilChanged())

export const hints = {
  active: hintsMode$,
  setActive: (value: boolean) => active.next(value),
  show: () => active.next(true),
  hide: () => active.next(false),
}

requestsFor<HintsRequest>('hints').subscribe(r => {
  if (typeof r.request.active === 'boolean') {
    hints.setActive(r.request.active)
  }
  r.handler({ status: 'ok' })
})
