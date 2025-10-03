import { Gio } from "astal";
import { catchError, Observable, share, shareReplay } from "rxjs";

type State = 'pomodoro' | 'short-break' | 'long-break' | 'none'

export type PomodoroState = {
  state: State
  elapsed: number
  duration: number
  isPaused: boolean
}

export interface Pomodoro {

  state: Observable<PomodoroState>

  start: () => void
  stop: () => void
  pause: () => void
  skip: () => void
  toggle: () => void
}


const PomodoroIface = `
<node>
    <interface name="org.gnome.Pomodoro">
        <method name="Start"/>
        <method name="Stop"/>
        <method name="Pause"/>
        <method name="Skip"/>
        <property name="State" type="s" access="read"/>
        <property name="Elapsed" type="d" access="read"/>
        <property name="IsPaused" type="b" access="read"/>
        <property name="StateDuration" type="d" access="read"/>
        <signal name="PropertiesChanged"/>
    </interface>
</node>
`
const PomodoroProxy = Gio.DBusProxy.makeProxyWrapper(PomodoroIface);

let pomodoroService: Pomodoro | null = null

export const getPomodoroService: () => Pomodoro = () => {
  if (pomodoroService != null) return pomodoroService
  const pomodoro = PomodoroProxy(Gio.DBus.session, 'org.gnome.Pomodoro', '/org/gnome/Pomodoro')

  const state = new Observable<PomodoroState>(e => {
    e.next({
      state: toState(pomodoro.State),
      elapsed: pomodoro.Elapsed,
      isPaused: pomodoro.IsPaused,
      duration: pomodoro.StateDuration
    })
    const connection = pomodoro.connect("g-properties-changed", (args) => {
      e.next({
        state: toState(args.State),
        elapsed: args.Elapsed,
        isPaused: args.IsPaused,
        duration: args.StateDuration
      })
    })
    return () => pomodoro.disconnect(connection)
  }).pipe(
    shareReplay(1)
  )

  pomodoroService = {
    state: state,
    start: () => pomodoro.StartRemote(),
    stop: () => pomodoro.StopRemote(),
    pause: () => pomodoro.PauseRemote(),
    skip: () => pomodoro.SkipRemote(),
    toggle: () => {
      if (pomodoro.IsPaused) {
        pomodoro.StartRemote()
      } else {
        pomodoro.PauseRemote()
      }
    }
  }
  return pomodoroService
}

function toState(state: string): State {
  return state == null || state == "null" ? 'none' : state as State
}
