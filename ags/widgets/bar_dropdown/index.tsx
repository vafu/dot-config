import Astal from 'gi://Astal?version=4.0'
import { App, Gdk, Gtk } from 'astal/gtk4'
import { NetworkQuicktoggle } from './network'
import { PowerProfileQuicktoggle } from './power_profile'
import { BluetoothQuicktoggle } from './bluetooth'
import Adw from 'gi://Adw?version=1'
import { exec } from 'astal'

const toggles = [
  NetworkQuicktoggle((page) => navigation.push(page)),
  <BluetoothQuicktoggle />,
  <PowerProfileQuicktoggle />,
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
            onClicked={() => exec('systemctl suspend')}
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

export default () => (
  <window
    visible={false}
    name="network-config"
    cssClasses={['bar-dropdown']}
    application={App}
    resizable={false}
    layer={Astal.Layer.OVERLAY}
    exclusivity={Astal.Exclusivity.NORMAL}
    keymode={Astal.Keymode.EXCLUSIVE}
    anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
    onKeyPressed={(_, k, c) => {if (k == Gdk.KEY_Escape) App.toggle_window('network-config')}}
  >
    {navigation}
  </window>
)
