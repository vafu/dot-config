export * from './util'

import {
  distinctUntilChanged,
  filter,
  map,
  Observable,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs'
import { Accessor, createBinding } from 'gnim'
import GObject from 'ags/gobject'
import { Gtk } from 'ags/gtk4'

const empty = Symbol('empty value')

export function subscribeTo<W extends Gtk.Widget, T>(
  widget: W,
  observable: Observable<T>,
  sub: (value: T, self: W) => void,
) {
  const d = observable.subscribe(t => sub(t, widget))
  widget.connect('destroy', () => d.unsubscribe())
}

export function fromConnectable<T extends GObject.Object, P extends keyof T>(
  object: T,
  property: Extract<P, string>,
): Observable<T[P]> {
  if (object == null)
    throw Error(
      `Trying to create observable for ${String(property)} from null!`,
    )
  return asObservable(createBinding(object, property)).pipe(
    filter(p => p != null),
    shareReplay(1),
  )
}

export function asObservable<Value>(
  binding: Accessor<Value>,
): Observable<Value> {
  if (binding == null)
    throw Error(`Trying to create observable from null binding!`)
  return new Observable(o => {
    try {
      const initial = binding.get()
      if (initial != null) o.next(initial)
    } catch (err) {
      // GObject might not be fully initialized yet, skip initial value
      console.warn('Failed to get initial value from binding:', err)
    }
    return binding.subscribe(() => {
      try {
        o.next(binding.get())
      } catch (err) {
        console.error('Failed to get value from binding:', err)
      }
    })
  })
}

export function bindAs<T, R>(
  observable: Observable<T>,
  mapper: (value: T) => R,
  initial: R,
): Accessor<R> {
  let value: R | typeof empty = initial
  const shared = observable.pipe(
    map(mapper),
    distinctUntilChanged(),
    tap({ next: v => (value = v) }),
    shareReplay(1),
  )

  const get = (): R => {
    return value !== empty ? value : (shared.subscribe(), value as R)
  }

  return new Accessor(get, callback => {
    const sub = shared.subscribe(callback)
    return () => sub.unsubscribe()
  })
}

export function bindString<T>(observable: Observable<T>, initial = ''): Accessor<string> {
  return bindAs(observable, v => v.toString(), initial)
}

export function binding<T>(
  observable: Observable<T>,
  initial: T,
): Accessor<T> {
  let value: T | typeof empty = initial
  const shared = observable.pipe(
    tap({ next: v => (value = v) }),
    shareReplay(1),
  )

  const get = (): T => {
    return value !== empty ? value : (shared.subscribe(), value as T)
  }

  return new Accessor(get, callback => {
    const sub = shared.subscribe(callback)
    return () => sub.unsubscribe()
  })
}

export function disposeOnDestroy(widget: Gtk.Widget, disposable: () => void) {
  widget.connect('destroy', () => disposable())
}

export function bindProp<T, K extends keyof T>(obs: Observable<T>, name: K, initial: T[K]) {
  return binding(obs.pipe(map(v => v[name])), initial)
}

export function fromChain<T extends GObject.Object, P extends keyof T>(
  observable: Observable<T>,
  prop: Extract<P, string>,
): Observable<T[P]> {
  return observable.pipe(switchMap(obj => fromConnectable(obj, prop)))
}







