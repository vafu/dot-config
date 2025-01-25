import { Gtk } from 'astal/gtk4'
import { binding, bindProp } from 'rxbinding'
import { Observable } from 'rx'

export type Level = {
  type: 'level'
  value: number
  iconName: string
}
export type Image = {
  type: 'image'
  iconName: string
}
export const Hidden = { type: 'hidden' }

export type State = typeof Hidden | Level

export function OnScreenProgress({ states }: { states: Observable<State> }) {
  const state = states.shareReplay(1)

  const levels = state.filter((v) => v.type == 'level') as Observable<Level>

  return (
    <revealer
      revealChild={binding(state.map((s) => s != Hidden))}
      transitionType={Gtk.RevealerTransitionType.CROSSFADE}
    >
      <box cssClasses={['OSD']} orientation={Gtk.Orientation.VERTICAL}>
        <image
          iconName={bindProp(levels, 'iconName')}
          iconSize={Gtk.IconSize.LARGE}
        />
        <levelbar
          valign={Gtk.Align.CENTER}
          widthRequest={100}
          value={bindProp(levels, 'value')}
        />
      </box>
    </revealer>
  )
}

