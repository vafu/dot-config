import Astal from 'gi://Astal?version=4.0'
import { App, Gtk } from 'astal/gtk4'
import { Box, Label } from 'widgets'
import Adw from 'gi://Adw?version=1'

function SwitchRow() {
  return new Adw.SwitchRow({
    title: 'Wifi',
    hexpand: true
  })
}

export default () => (
  <window
    visible={false}
    name="network-config"
    className="bar-dropdown"
    application={App}
    exclusivity={Astal.Exclusivity.NORMAL}
    anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
  >
    <Box>
      <SwitchRow />
    </Box>
  </window>
)
