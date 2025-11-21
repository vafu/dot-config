import { execAsync } from 'ags/process'
import Gio from 'gi://Gio?version=2.0'
import { Quicktoggle } from './quicktoggle'
import { bindAs } from 'rxbinding'
import { Observable } from 'rxjs'

const prop = 'color-scheme'
const preferDark = 'prefer-dark'
const preferLight = 'prefer-light'

const settings = Gio.Settings.new('org.gnome.desktop.interface')
function isDark() {
  const currentSetting = settings.get_string(prop)
  return currentSetting == preferDark
}

const dark = new Observable(e => {
  e.next(isDark())
  const id = settings.connect(`changed::${prop}`, s => e.next(isDark()))
  return () => settings.disconnect(id)
})

function toggle() {
  const theme = isDark() ? preferLight : preferDark
  const cmd = `gsettings set org.gnome.desktop.interface color-scheme '${theme}'`
  execAsync(cmd)
}

export function DarkLightQuicktoggle() {
  return (
    <Quicktoggle
      enabled={false}
      iconName={'night-light-symbolic'}
      label={bindAs(dark, d => (d ? 'Dark' : 'Light'), 'Light')}
      onClicked={() => toggle()}
    />
  )
}
