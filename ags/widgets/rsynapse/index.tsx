export * from './search'
export * from './list'

import { BehaviorSubject } from 'rxjs'
import { requestsFor } from 'services/requests'
const active = new BehaviorSubject(false)

const controls = {
  active: active,
  show: () => active.next(true),
  hide: () => active.next(false),
  text: '',
}

export default controls

requestsFor("rsynapse").subscribe(r => {
  controls.show()
  r.handler({ status: 'ok' })
})
