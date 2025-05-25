import { exec, Gio, GLib } from 'astal'

const settings = Gio.Settings.new('org.gnome.desktop.interface')

export function prepareTheme() {
  const colorScheme = settings.get_string('color-scheme')
  updateGtkTheme(colorScheme)

  settings.connect('changed::color-scheme', (s: Gio.Settings) => {
    const newColorScheme = s.get_string('color-scheme')
    updateGtkTheme(newColorScheme)
  })
}

function updateGtkTheme(colorScheme: string) {
  const isDark = colorScheme === 'prefer-dark'
  const theme = isDark ? 'ags-theme-dark' : 'ags-theme'
  // Get the paths
  const cmd = `gsettings set org.gnome.desktop.interface gtk-theme '${theme}'` 
  console.log(cmd)
  exec(cmd)
}
