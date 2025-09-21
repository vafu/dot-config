import { Button, Label } from 'astal/gtk4/widget'
import AstalMpris from 'gi://AstalMpris?version=0.1'
import { bindAs, binding, fromConnectable } from 'rxbinding'
import { combineLatest, map, shareReplay, switchMap } from 'rxjs'
import { PanelButton } from './panel-buttons'

const mpris = AstalMpris.get_default()
const player = fromConnectable(mpris, 'players').pipe(
  map(
    a =>
      a.find(p => p.playback_status == AstalMpris.PlaybackStatus.PLAYING) ??
      a.find(p => p.can_play),
  ),
)
const playerState = player.pipe(
  switchMap(p => fromConnectable(p, 'playback_status')),
  shareReplay(),
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
  )

  const playerStateCss = player.pipe(
    switchMap(p => fromConnectable(p, 'playback_status')),
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

  return (
    <box cssClasses={['mpris-widget', 'bar-widget']}>
      <Label
        label={binding(metadata)}
        cssClasses={bindAs(playerStateCss, c => [c])}
      />
    </box>
  )
}
