import AstalMpris from 'gi://AstalMpris?version=0.1'
import { bindAs, binding, fromConnectable } from 'rxbinding'
import { combineLatest, filter, map, of, shareReplay, startWith, switchMap } from 'rxjs'

const mpris = AstalMpris.get_default()
const player = fromConnectable(mpris, 'players').pipe(
  map(
    a =>
      a.find(p => p.playback_status == AstalMpris.PlaybackStatus.PLAYING) ??
      a.find(p => p.can_play),
  ),
  filter(p => p != undefined),
  shareReplay(1),
)

export const MPRISWidget = () => {
  const metadata = player.pipe(
    switchMap(p =>
      combineLatest(
        fromConnectable(p, 'artist'),
        fromConnectable(p, 'title'),
        (...[artist, title]) => `${artist} - ${title}`,
      ),
    ),
    startWith('')
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
    startWith('')
  )

  return (
    <box cssClasses={['mpris-widget', "barblock"]}>
      <label
        label={binding(metadata)}
        cssClasses={bindAs(playerStateCss, c => [c])}
      />
    </box>
  )
}
