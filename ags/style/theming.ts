import { exec, Gio } from 'astal'
import { App, Gtk } from 'astal/gtk4'
import obtainWmService from 'services'
const settings = Gio.Settings.new('org.gnome.desktop.interface')
const colors = ['green', 'red', 'purple']
export function prepareTheme() {
  prepareGtk()
  prepareIcons()
  // obtainWmService('workspace').activeWorkroom.subscribe((wr) =>
  //   exec(
  //     `gsettings set org.gnome.desktop.interface accent-color '${colors[wr.idx]}'`
  //   )
  // )
}

function prepareGtk() {
  syncAccent(null)
  const colorScheme = settings.get_string('color-scheme')
  updateGtkTheme(colorScheme)
  settings.connect('changed::color-scheme', (s: Gio.Settings) => {
    const newColorScheme = s.get_string('color-scheme')
    updateGtkTheme(newColorScheme)
  })
  settings.connect('changed::accent-color', (s: Gio.Settings) => {
    syncAccent(s.get_string('accent-color'))
  })
}
function prepareIcons() {
  const d = App.get_monitors()[0].display
  const t = Gtk.IconTheme.get_for_display(d)
  const s = Gtk.Settings.get_for_display(d)
  s.set_property('gtk-icon-theme-name', 'Material')
}
function syncAccent(color?: string) {
  exec(`bash scripts/sync_accent.sh ${color ?? ''}`)
}
function updateGtkTheme(colorScheme: string) {
  const themeName = settings.get_string('gtk-theme').replace("-dark", '')

  const isDark = colorScheme === 'prefer-dark'
  const theme = isDark ? `${themeName}-dark` : themeName
  // Get the paths
  exec(`gsettings set org.gnome.desktop.interface gtk-theme '${theme}'`)
}
