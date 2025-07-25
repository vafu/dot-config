import { filter, map, Subject, take } from 'rxjs'

export type CliResponse = { status: 'ok' }

const relay = new Subject<string>()
const responses = new Subject<CliResponse & { request: string }>()

export function requestsFor(request: string) {
  return relay.pipe(
    filter((req) => req == request),
    map((req) => {
      return (resp: CliResponse) => {
        const result = { request: req, ...resp }
        responses.next(result)
      }
    })
  )
}

export function handleRequest(
  request: string,
  handler: (response: any) => void
) {
  responses
    .pipe(
      filter((r) => r.request == request),
      take(1),
      map((r) => r.status)
    )
    .subscribe(handler)
  relay.next(request)
}
