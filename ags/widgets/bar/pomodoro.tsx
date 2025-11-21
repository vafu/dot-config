import { map, shareReplay } from 'rxjs'
import { getPomodoroService } from 'services/pomodoro'
import { bindAs, binding } from 'rxbinding'
import { WidgetProps } from 'widgets'
import { Gtk } from 'ags/gtk4'
import { MaterialIcon } from 'widgets/materialicon'

const pomodoro = getPomodoroService()
const state = pomodoro.state.pipe(shareReplay(1))

export const PomodoroWidget = (props: WidgetProps) => {
  const buttonClasses = ['flat', 'circular']

  const isNotNone = state.pipe(map(s => s.state !== 'none'))
  const isNotPaused = state.pipe(map(s => s.state !== 'none' && !s.isPaused))
  const canStart = state.pipe(map(s => s.state === 'none' || s.isPaused))
  const timeLabel = state.pipe(map(s => formatTime(s.duration, s.elapsed)))

  const controls = (
    <box>
      <button
        cssClasses={buttonClasses}
        iconName="media-playback-stop"
        visible={binding(isNotNone, false)}
        onClicked={pomodoro.stop}
      />
      <button
        cssClasses={buttonClasses}
        iconName="media-playback-pause"
        visible={binding(isNotPaused, false)}
        onClicked={pomodoro.pause}
      />
      <button
        cssClasses={buttonClasses}
        iconName="media-playback-start"
        visible={binding(canStart, true)}
        onClicked={pomodoro.start}
      />
      <button
        cssClasses={buttonClasses}
        iconName="media-skip-forward"
        visible={binding(isNotNone, false)}
        onClicked={pomodoro.skip}
      />
    </box>
  ) as Gtk.Widget
  controls.hide()

  const status = (
    <box>
      <MaterialIcon
        icon={bindAs(state, s => {
          switch (s.state) {
            case 'pomodoro':
              return 'arrows_input'
            case 'short-break':
              return 'coffee'
            case 'long-break':
              return 'bakery_dining'
            case 'none':
              return 'timer_off'
          }
        }, 'timer_off')}
      />
      <label
        label={bindAs(state, s => formatTime(s.duration, s.elapsed), '00:00')}
        visible={bindAs(state, s => s.state !== 'none', false)}
      />
    </box>
  ) as Gtk.Widget

  return (
    <box cssClasses={(props.cssClasses ?? []).concat(['pomodoro'])}>
      <Gtk.EventControllerMotion
        onEnter={() => {
          status.hide()
          controls.show()
        }}
        onLeave={() => {
          status.show()
          controls.hide()
        }}
      />
      {controls}
      {status}
    </box>
  )
}

const formatTime = (duration: number, elapsed: number): string => {
  const seconds = Math.floor(duration) - Math.floor(elapsed)
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}


