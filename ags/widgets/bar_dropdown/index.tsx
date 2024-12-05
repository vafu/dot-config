import Astal from 'gi://Astal?version=4.0'
import { App, Gtk } from 'astal/gtk4'
import { Box } from 'widgets'
import { NetworkQuicktoggle } from './network'
import { PowerProfileQuicktoggle } from './power_profile'
import { BluetoothQuicktoggle } from './bluetooth'

const toggles = [
  <NetworkQuicktoggle />,
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

export default () => (
  <window
    visible={false}
    name="network-config"
    className="bar-dropdown"
    application={App}
    exclusivity={Astal.Exclusivity.EXCLUSIVE}
    anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
  >
    <Quicktoggles />
  </window>
)
