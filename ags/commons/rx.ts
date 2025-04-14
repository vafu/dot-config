import {
  EMPTY,
  onErrorResumeNextWith,
  OperatorFunction,
  tap,
} from 'rxjs'

export function onErrorEmpty<T>(): OperatorFunction<T, T> {
  return onErrorResumeNextWith(EMPTY)
}

export function logNext<T>(logger: (v: T) => string): OperatorFunction<T, T> {
  return tap({ next: (v) => console.log(logger(v)) })
}

