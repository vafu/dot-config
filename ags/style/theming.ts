import { execAsync } from 'ags/process'
import { writeFile, writeFileAsync } from 'ags/file'
import Gio from 'gi://Gio?version=2.0'
import App from 'ags/gtk4/app'
import { Gtk } from 'ags/gtk4'
import { distinctUntilChanged, map, shareReplay, startWith } from 'rxjs'
import { getPomodoroService } from 'services/pomodoro'
import { requestsFor } from 'services/requests'
const settings = Gio.Settings.new('org.gnome.desktop.interface')

export function prepareTheme() {
  prepareGtk()
  prepareIcons()
  preparePomodoro()
}

function preparePomodoro() {
  const pomodoro_color_css = getPomodoroService().state.pipe(
    distinctUntilChanged(
      (p, c) => p.state == c.state && c.elapsed - p.elapsed < 60,
    ),
    map(s => {
      if (s.state == 'pomodoro') {
        const progress = s.elapsed / s.duration
        if (progress < 0.5)
          return `mix(@bg_mixed_green, @bg_mixed_yellow, ${progress * 2})`
        return `mix(@bg_mixed_yellow, @bg_mixed_red, ${progress * 2 - 1})`
      }
      return '@theme_bg_color'
    }),
    startWith('@theme_bg_color'),
    map(r => `@define-color bg ${r};`),
    shareReplay(1),
  )

  pomodoro_color_css.subscribe(d => {
    writeFile('./style/dyn.css', d)
  })
}

type Request = { command: 'scheme-toggle' }
function prepareGtk() {
  // syncAccent(null)
  const colorScheme = settings.get_string('color-scheme')
  updateGtkTheme(colorScheme).catch()
  requestsFor<Request>('scheme-toggle').subscribe(r => {
    const newScheme = settings.get_string('color-scheme') == "prefer-light" ? "prefer-dark" : "prefer-light"
    settings.set_string("color-scheme", newScheme)
    r.handler({ status: "ok" })
  })
  settings.connect('changed::color-scheme', (s: Gio.Settings) => {
    const newColorScheme = s.get_string('color-scheme')
    updateGtkTheme(newColorScheme).catch()
  })
  settings.connect('changed::accent-color', (s: Gio.Settings) => {
    syncAccent(s.get_string('accent-color')).catch()
  })
}
function prepareIcons() {
  const d = App.get_monitors()[0].display
  const s = Gtk.Settings.get_for_display(d)
  s.set_property('gtk-icon-theme-name', 'Material')
}
async function syncAccent(color?: string) {
  await execAsync(`bash scripts/sync_accent.sh ${color ?? ''}`)
}
async function updateGtkTheme(colorScheme: string) {
  const themeName = settings.get_string('gtk-theme').replace('-dark', '')

  const isDark = colorScheme === 'prefer-dark'
  const theme = isDark ? `${themeName}-dark` : themeName
  const style = isDark ? 'dark' : 'light'
  await execAsync(
    `gsettings set org.gnome.desktop.interface gtk-theme '${theme}'`,
  )
  await execAsync(`bash scripts/legacy_alacritty.sh --${style}`)
}
