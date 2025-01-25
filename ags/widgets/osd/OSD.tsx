import { Gtk } from "astal/gtk4"
import { binding } from "rxbinding"
import { Observable } from "rx"

export type Level = { type: 'level', value: number, iconName: string }
export const Hidden = { type: 'hidden' }

export type State = typeof Hidden | Level

export function OnScreenProgress({ states }: { states: Observable<State> }) {
  const state = states
    .flatMapLatest(s =>
      Observable.merge<State>(
        Observable.just(s),
        Observable.just(Hidden).delay(2000)
      )
    )
    .shareReplay(1)

  const levels = state.filter(v => v.type == 'level') as Observable<Level>

  return (
    <revealer
      revealChild={binding(state.map(s => s.type != "hidden"))}
      transitionType={Gtk.RevealerTransitionType.CROSSFADE}
    >
      <box cssClasses={["OSD"]}>
        <image iconName={bindProp(levels, 'iconName')} />
        <levelbar
          valign={Gtk.Align.CENTER}
          widthRequest={100}
          value={bindProp(levels, 'value')} />
        <label label={binding(mapProp(levels, 'value').map(v => `${Math.floor(v * 100)}%`))} />
      </box>
    </revealer>
  )
}

function mapProp<T, K extends keyof T>(obs: Observable<T>, name: K) {
  return obs.map(v => v[name])
}

function bindProp<T, K extends keyof T>(obs: Observable<T>, name: K) {
  return binding(obs.map(v => v[name]))
}
