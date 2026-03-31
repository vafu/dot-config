import { BehaviorSubject } from 'rxjs'
import { requestsFor } from 'services/requests'

type TodoRequest = { command: 'todo'; file?: string }

const active = new BehaviorSubject(false)

const controls = {
  active,
  show: () => active.next(true),
  hide: () => active.next(false),
}

export default controls

requestsFor<TodoRequest>('todo').subscribe(r => {
  if (active.getValue()) {
    controls.hide()
  } else {
    controls.show()
  }
  r.handler({ status: 'ok' })
})
