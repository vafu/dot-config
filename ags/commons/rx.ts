import {
  EMPTY,
  map,
  onErrorResumeNextWith,
  OperatorFunction,
  publish,
  skip,
  startWith,
  tap,
  zipWith,
} from 'rxjs'

export function onErrorEmpty<T>(): OperatorFunction<T, T> {
  return onErrorResumeNextWith(EMPTY)
}

export function logNext<T>(logger: (v: T) => string): OperatorFunction<T, T> {
  return tap({ next: (v) => console.log(logger(v)) })
}

export function withPrevious<T>(initial: T): OperatorFunction<T, T[]> {
  return (source) =>
    source.pipe(
      startWith(initial),
      publish(shared =>
        shared.pipe(zipWith(shared.pipe(skip(1))))
      )
    )
}

type Diff<T> = {
  added: T[]
  removed: T[]
  unchanged: T[]
}

export function diffs<T>(): OperatorFunction<T[], Diff<T>> {
  return (source) =>
    source.pipe(
      withPrevious([]),
      map(([p, c]) => {
        const added: T[] = []
        const removed: T[] = []
        const unchanged: T[] = []

        for (const prev of p) {
          if (c.includes(prev)) {
            unchanged.push(prev)
          } else {
            removed.push(prev)
          }
        }

        for (const curr of c) {
          if (!p.includes(curr)) {
            added.push(curr)
          }
        }

        return { added, removed, unchanged }
      })
    )
}

