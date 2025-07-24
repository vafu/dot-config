export * from './util'

import {
    distinctUntilChanged,
  filter,
  map,
  Observable,
  pipe,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs'
import Binding, { bind, Connectable } from 'astal/binding'
import Gtk from 'gi://Gtk?version=4.0'

export function subscribeTo<W extends Gtk.Widget, T>(
  widget: W,
  observable: Observable<T>,
  sub: (value: T, self: W) => void
) {
  const d = observable.subscribe((t) => sub(t, widget))
  widget.connect('destroy', () => d.unsubscribe())
}

export function fromConnectable<T extends Connectable, P extends keyof T>(
  object: T,
  property: P
): Observable<T[P]> {
  if (object == null)
    throw Error(
      `Trying to create observable for ${String(property)} from null!`
    )
  return asObservable(bind(object, property)).pipe(
    filter((p) => p != null),
    shareReplay(1)
  )
}

export function asObservable<Value>(
  binding: Binding<Value>
): Observable<Value> {
  if (binding == null)
    throw Error(`Trying to create observable from null binding!`)
  return new Observable((o) => {
    const initial = binding.get()
    if (initial != null) o.next(initial)
    return binding.subscribe((value) => o.next(value))
  })
}

export function bindAs<T, R>(
  observable: Observable<T>,
  mapper: (value: T) => R
): Binding<R> {
  return binding(observable.pipe(map(mapper), distinctUntilChanged()))
}

export function bindString<T>(observable: Observable<T>): Binding<string> {
  return bindAs(observable, (v) => v.toString())
}

export function binding<T>(
  observable: Observable<T>,
  initial = null
): Binding<T> {
  let value: T | null = initial
  const shared = observable.pipe(
    tap({ next: (v) => (value = v) }),
    shareReplay(1)
  )

  return bind({
    subscribe: (callback) => shared.subscribe(callback).unsubscribe,
    get: () => value,
  })
}

export function disposeOnDestroy(widget: Gtk.Widget, disposable: () => void) {
  widget.connect('destroy', () => disposable())
}

export function bindProp<T, K extends keyof T>(obs: Observable<T>, name: K) {
  return binding(obs.pipe(map((v) => v[name])))
}

export function fromChain<T extends Connectable, P extends keyof T>(
  observable: Observable<T>,
  prop: P
): Observable<T[P]> {
  return observable.pipe(switchMap((obj) => fromConnectable(obj, prop)))
}
