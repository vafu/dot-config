import {
  EMPTY,
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

