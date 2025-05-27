import { exec, Gio } from 'astal'
import obtainService from 'services'

const settings = Gio.Settings.new('org.gnome.desktop.interface')

const colors = ['green', 'red', 'purple']

export function prepareTheme() {
  prepareGtk()

  obtainService('workspace').activeWorkroom.subscribe((wr) =>
    exec(
      `gsettings set org.gnome.desktop.interface accent-color '${colors[wr.idx]}'`
    )
  )
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

function syncAccent(color?: string) {
  exec(`bash scripts/sync_accent.sh ${color ?? ''}`)
}

function updateGtkTheme(colorScheme: string) {
  const isDark = colorScheme === 'prefer-dark'
  const theme = isDark ? 'ags-theme-dark' : 'ags-theme'
  // Get the paths
  exec(`gsettings set org.gnome.desktop.interface gtk-theme '${theme}'`)
}
