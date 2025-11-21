import { Gtk } from 'ags/gtk4'
import { NetworkQuicktoggle } from './network'
import { PowerProfileQuicktoggle } from './power_profile'
import { BluetoothQuicktoggle } from './bluetooth'
import Adw from 'gi://Adw?version=1'
import { execAsync } from 'ags/process'
import { DarkLightQuicktoggle } from './darklight'

export const QuicktoggleMenu = () => {
  const toggles = [
    NetworkQuicktoggle((page) => navigation.push(page)),
    <BluetoothQuicktoggle />,
    <PowerProfileQuicktoggle />,
    <DarkLightQuicktoggle />,
  ]

  function Quicktoggles() {
    return (
      <box cssClasses={['quicktoggle-container']}>
        <box orientation={Gtk.Orientation.VERTICAL}>
          {toggles.filter((_, i) => i % 2 == 0)}
        </box>
        <box orientation={Gtk.Orientation.VERTICAL}>
          {toggles.filter((_, i) => i % 2 != 0)}
        </box>
      </box>
    )
  }

  function Main() {
    return (
      <Adw.NavigationPage>
        <box orientation={Gtk.Orientation.VERTICAL}>
          <box>
            <box hexpand={true} />
            <button
              hexpand={false}
              cssClasses={['flat', 'circular', 'icon-button']}
              onClicked={() => execAsync('systemctl suspend').catch()}
              icon_name={'system-shutdown-symbolic'}
            />
          </box>
          <Quicktoggles />
        </box>
      </Adw.NavigationPage>
    )
  }

  const navigation = new Adw.NavigationView({ cssClasses: ['quickbar-nav'] })
  navigation.push(Main())

  return navigation
}
