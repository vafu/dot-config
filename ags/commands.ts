import { take } from 'rxjs'
import obtainWmService from 'services'
import { requestsFor } from 'services/requests'

type Request = { command: 'tab' | 'ws'; target: number; move: boolean }

// const ws = await obtainWmService('workspace')

export function bindCommands() {
  // requestsFor<Request>('tab', 'ws').subscribe(r => {
  //   switch (r.request.command) {
  //     case 'tab':
  //       ws.activeWorkspace.pipe(take(1)).subscribe(ws => {
  //         ws.switchToTab(r.request.target, r.request.move)
  //         r.handler({ status: 'ok' })
  //       })
  //       break
  //     case 'ws':
  //       ws.switchToWs(r.request.target, r.request.move)
  //       r.handler({ status: 'ok' })
  //       break
  //   }
  // })
}
