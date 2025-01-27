import { Disposable, Observable } from 'rx'
import Binding, { bind, Connectable } from 'astal/binding'
import Gtk from 'gi://Gtk?version=4.0'

export function subscribeTo<W extends Gtk.Widget, T>(
  widget: W,
  observable: Observable<T>,
  sub: (value: T, self: W) => void
) {
  const d = observable.subscribe((t) => sub(t, widget))
  widget.connect('destroy', () => d.dispose())
}

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

export function binding<T>(
  observable: Observable<T>,
  initial = null
): Binding<T> {
  let value: T | null = initial
  const shared = observable.doOnNext((v) => (value = v)).shareReplay(1)

  return bind({
    subscribe: (callback) => shared.subscribe(callback).dispose,
    get: () => value,
  })
}

export function disposeOnDestroy(widget: Gtk.Widget, disposable: Disposable) {
  widget.connect('destroy', () => disposable.dispose())
}

export function bindProp<T, K extends keyof T>(obs: Observable<T>, name: K) {
  return binding(obs.map((v) => v[name]))
}

