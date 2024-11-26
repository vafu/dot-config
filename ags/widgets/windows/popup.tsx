import Astal from 'gi://Astal?version=4.0'
import { App } from 'astal/gtk4'

export const NetworkConfig = () => (
  <window
    visible={false}
    name="network-config"
    application={App}
    exclusivity={Astal.Exclusivity.EXCLUSIVE}
  >
  </window>
)
