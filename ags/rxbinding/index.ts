import { Disposable, Observable } from 'rx'
import Binding, { bind, Connectable } from 'astal/binding'

export function obs<T extends Connectable, P extends keyof T>(
  object: T,
  property: P
): Observable<T[P]> {
  if (object == null)
    throw Error(
      `Trying to create observable for ${String(property)} from null!`
    )
  return asObservable(bind(object, property))
}

export function asObservable<Value>(
  binding: Binding<Value>
): Observable<Value> {
  if (binding == null)
    throw Error(`Trying to create observable from null binding!`)
  return Observable.create((o) => {
    const initial = binding.get()
    if (initial != null) o.onNext(initial)
    return Disposable.create(binding.subscribe((value) => o.onNext(value)))
  })
}

export function binding<T>(observable: Observable<T>): Binding<T> {
  let value: T | null
  const shared = observable
    .doOnNext((v) => (value = v))
    .replay()
    .refCount()

  return bind({
    subscribe: (callback) => shared.subscribe(callback).dispose,
    get: () => value,
  })
}
