import AstalMpris from 'gi://AstalMpris?version=0.1'
import Pango from 'gi://Pango?version=1.0'
import { bindAs, binding, fromConnectable } from 'rxbinding'
import {
  combineLatest,
  filter,
  map,
  of,
  pipe,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs'
import { WidgetProps } from 'widgets'

const mpris = AstalMpris.get_default()
const player = fromConnectable(mpris, 'players').pipe(
  map(
    a =>
      a.find(p => p.playback_status == AstalMpris.PlaybackStatus.PLAYING) ??
      a.find(p => p.can_play),
  ),
  filter(p => !!p),
  shareReplay(1),
)

export const MPRISWidget = (props: WidgetProps) => {
  const metadata = player.pipe(
    switchMap(p =>
      combineLatest(
        fromConnectable(p, 'artist'),
        fromConnectable(p, 'title'),
        (...[artist, title]) =>
          artist.length > 0 && title.length > 0 ? `${artist} - ${title}` : '',
      ),
    ),
    startWith(''),
    shareReplay(1),
  )

  const playerStateCss = player.pipe(
    switchMap(p => {
      if (p) {
        return fromConnectable(p, 'playback_status').pipe(
          map(s => {
            switch (s) {
              case AstalMpris.PlaybackStatus.PAUSED:
                return 'paused'
              case AstalMpris.PlaybackStatus.STOPPED:
                return 'stopped'
              case AstalMpris.PlaybackStatus.PLAYING:
                return 'playing'
            }
          }),
        )
      } else {
        return of('')
      }
    }),
    startWith(''),
  )

  return (
    <box
      visible={bindAs(metadata, m => m.length > 0)}
      cssClasses={(props.cssClasses ?? []).concat(['mpris-widget'])}
    >
      <label
        ellipsize={Pango.EllipsizeMode.MIDDLE}
        max_width_chars={30}
        label={binding(metadata)}
        tooltipText={binding(metadata)}
        cssClasses={bindAs(playerStateCss, c => [c])}
      />
    </box>
  )
}
