import Pango from 'gi://Pango?version=1.0'
import Service from 'services'
import { binding } from 'rxbinding'

const active = Service('window').active

export const WindowTitle = () => (
  <box className="window-title bar-widget">
    <label cssClasses={["cls"]} label={binding(active.cls)} />
    <label ellipsize={Pango.EllipsizeMode.END} label={binding(active.title)} />
  </box>
)
