import { BehaviorSubject } from 'rxjs'
import { requestsFor } from 'services/requests'

type ApprovalRequest = { command: 'agent-approvals' }

const active = new BehaviorSubject(false)
const targetSession = new BehaviorSubject<string | null>(null)

function setVisible(visible: boolean, sessionId: string | null = null) {
  targetSession.next(sessionId)
  active.next(visible)
}

const controls = {
  active,
  targetSession,
  show: () => setVisible(true),
  showFor: (sessionId: string) => setVisible(true, sessionId),
  hide: () => setVisible(false),
  toggle: () => {
    setVisible(!active.getValue())
  },
}

requestsFor<ApprovalRequest>('agent-approvals').subscribe(r => {
  controls.toggle()
  r.handler({ status: 'ok' })
})

export default controls
