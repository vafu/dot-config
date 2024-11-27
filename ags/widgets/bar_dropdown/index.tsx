import Astal from 'gi://Astal?version=4.0'
import { App } from 'astal/gtk4'
import { Label } from 'widgets'

export default () => (
  <window
    visible={false}
    name="network-config"
    className="bar-dropdown"
    application={App}
    exclusivity={Astal.Exclusivity.EXCLUSIVE}
    anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
  > 
    <Label label="test"/>
  </window>
)
