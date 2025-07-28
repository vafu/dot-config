import { filter, map, Observable, Subject, take } from 'rxjs'

export type CliResponse = { status: 'ok' }
export type Request = { command: string }
export type CliRequest = Request & { args: string[] }
export type Handler<T extends Request> = {
  request: T
  handler: (r: CliResponse) => void
}

const relay = new Subject<Request>()
const responses = new Subject<CliResponse & { request: Request }>()

export function requestsFor<T extends Request>(
  ...commands: T['command'][]
): Observable<Handler<T>> {
  return relay.pipe(
    filter(req => commands.includes(req.command)),
    map(req => {
      return {
        request: req as T,
        handler: (resp: CliResponse) => {
          const result = { request: req as T, ...resp }
          responses.next(result)
        },
      }
    }),
  )
}

export function handleRequest(req: string, handler: (response: any) => void) {
  const split = req.split(' ')
  const args = split.splice(1)
  const dyn = {}

  for (let i = 0; i < args.length; i++) {
    if (i % 2 != 0) {
      dyn[args[i - 1]] = parseStringToValue(args[i])
    }
  }

  const request = { command: split[0], ...dyn }

  responses
    .pipe(
      filter(resp => resp.request.command == request.command),
      take(1),
      map(r => r.status),
    )
    .subscribe(handler)
  relay.next(request)
}

function parseStringToValue(input: string): number | boolean | string {
  const lowerInput = input.toLowerCase()
  if (lowerInput === 'true') {
    return true
  }
  if (lowerInput === 'false') {
    return false
  }

  const numValue = parseFloat(input)
  if (!isNaN(numValue) && String(numValue) === input) {
    return numValue
  }

  return input
}
