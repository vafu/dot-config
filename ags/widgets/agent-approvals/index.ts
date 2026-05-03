import { BehaviorSubject } from 'rxjs'
import { requestsFor } from 'services/requests'

type ApprovalRequest = { command: 'agent-approvals' }

const active = new BehaviorSubject(false)

const controls = {
  active,
  show: () => active.next(true),
  hide: () => active.next(false),
  toggle: () => {
    if (active.getValue()) active.next(false)
    else active.next(true)
  },
}

requestsFor<ApprovalRequest>('agent-approvals').subscribe(r => {
  controls.toggle()
  r.handler({ status: 'ok' })
})

export default controls
