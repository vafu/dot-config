import Astal from 'gi://Astal?version=4.0'
import { App, Gtk } from 'astal/gtk4'
import { Box } from 'widgets'
import { NetworkQuicktoggle } from './network'
import { PowerProfileQuicktoggle } from './power_profile'
import { BluetoothQuicktoggle } from './bluetooth'
import Adw from 'gi://Adw?version=1'

const toggles = [
  NetworkQuicktoggle((page) => navigation.push(page)),
  <BluetoothQuicktoggle />,
  <PowerProfileQuicktoggle />,
]

function Quicktoggles() {
  return (
    <Box className="quicktoggle-container">
      <Box orientation={Gtk.Orientation.VERTICAL}>
        {toggles.filter((_, i) => i % 2 == 0)}
      </Box>
      <Box orientation={Gtk.Orientation.VERTICAL}>
        {toggles.filter((_, i) => i % 2 != 0)}
      </Box>
    </Box>
  )
}

function Main() {
  return (
    <Adw.NavigationPage>
      <Quicktoggles />
    </Adw.NavigationPage>
  )
}

const navigation = new Adw.NavigationView({ cssClasses: ['quickbar-nav'] })
navigation.push(Main())

export default () => (
  <window
    visible={false}
    name="network-config"
    className="bar-dropdown"
    application={App}
    resizable={false}
    layer={Astal.Layer.OVERLAY}
    exclusivity={Astal.Exclusivity.EXCLUSIVE}
    anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
  >
    {navigation}
  </window>
)
