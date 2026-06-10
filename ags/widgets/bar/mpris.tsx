import AstalMpris from 'gi://AstalMpris?version=0.1'
import { bindAs, binding, fromConnectable } from 'rxbinding'
import {
  combineLatest,
  concat,
  distinctUntilChanged,
  filter,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  timer,
} from 'rxjs'
import { WidgetProps } from 'widgets'
import { Subgroup } from './panel-widgets'
import { MaterialIcon } from 'widgets/materialicon'
import { AudioRoutePopover, defaultSpeakerTypeIcon } from './audio_route'

const mpris = AstalMpris.get_default()
const player = fromConnectable(mpris, 'players').pipe(
  map(
    a =>
      a.find(p => p.playback_status == AstalMpris.PlaybackStatus.PLAYING) ??
      a.find(p => p.can_play),
  ),
  filter(p => !!p),
  shareReplay({ bufferSize: 1, refCount: true }),
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
    shareReplay({ bufferSize: 1, refCount: true }),
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

  const metadataTimer = metadata.pipe(
    distinctUntilChanged(),
    switchMap(() => concat(
      of(true),
      timer(3000).pipe(map(() => false))
    )),
  )

  return (
    <Subgroup
      css_classes={(props.cssClasses ?? []).concat(['mpris-widget'])}
      revealWhen={metadataTimer}
    >
      <label
        label={binding(metadata, '')}
        tooltipText={binding(metadata, '')}
      />
      <menubutton
        css_classes={["flat", "circular", "button-subgroup-main"]}
        popover={AudioRoutePopover()}
      >
        <MaterialIcon
          icon={binding(defaultSpeakerTypeIcon, 'speaker')}
          tinted={bindAs(playerStateCss, s => s != "playing", false)}
          style={{ size: 24, fill: false }}
        />
      </menubutton>
    </Subgroup>
  )
}
