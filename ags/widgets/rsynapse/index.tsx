export * from './search'
export * from './list'

import { BehaviorSubject } from 'rxjs'
import { requestsFor } from 'services/requests'
const active = new BehaviorSubject(false)

const controls = {
  active: active,
  toggle: () => active.next(!active.getValue()),
  hide: () => active.next(false)
}

export default controls

requestsFor('rsynapse').subscribe((h) => {
  controls.toggle()
  h({ status: 'ok' })
})
