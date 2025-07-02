import { bindAs } from "rxbinding"
import { shareReplay } from "rxjs"
import { getPomodoroService } from "services/pomodoro"
import { MaterialIcon } from "widgets/materialicon"

const pomodoro = getPomodoroService()
const state = pomodoro.state.pipe(shareReplay())

export const PomodoroWidget = () => {

  const buttonClasses = ["flat", "circular"]

  const controls = <box>
    <button cssClasses={buttonClasses} iconName="media-playback-stop" visible={bindAs(state, s => s.state !== "none")} onClicked={pomodoro.stop} />
    <button cssClasses={buttonClasses} iconName="media-playback-pause" visible={bindAs(state, s => s.state !== "none" && !s.isPaused)} onClicked={pomodoro.pause} />
    <button cssClasses={buttonClasses} iconName="media-playback-start" visible={bindAs(state, s => s.state === "none" || s.isPaused)} onClicked={pomodoro.start} />
    <button cssClasses={buttonClasses} iconName="media-skip-forward" visible={bindAs(state, s => s.state !== "none")} onClicked={pomodoro.skip} />
  </box>
  controls.hide()

  const status =
    <box>
      <MaterialIcon icon={bindAs(state, s => {
        switch (s.state) {
          case "pomodoro": return "arrows_input"
          case "short-break": return "coffee"
          case "long-break": return "bakery_dining"
          case "none": return "timer_off"
        }
      })} />
      <label label={bindAs(state, s => formatTime(s.duration, s.elapsed))} visible={bindAs(state, s => s.state !== "none")} />
    </box>


  return <box cssClasses={["pomodoro", "bar-widget"]} onHoverEnter={() => {
    status.hide()
    controls.show()
  }}
    onHoverLeave={() => {
      status.show()
      controls.hide()
    }}
  >
    {controls}
    {status}
  </box >
}

const formatTime = (duration: number, elapsed: number): string => {
  const seconds = Math.floor(duration) - Math.floor(elapsed)
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};
