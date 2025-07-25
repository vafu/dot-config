import Pango from 'gi://Pango?version=1.0'
import Service from 'services'
import { bindAs, binding } from 'rxbinding'
import { getRsynapseService } from 'services/rsynapse'
import { Binding } from 'astal'

const active = Service('window').active

const rsynapse = getRsynapseService()

export const WindowTitle = (props: { visible: Binding<boolean> }) => (
  <box cssClasses={['window-title', 'bar-widget']} visible={props.visible}>
    <label cssClasses={['cls']} label={binding(active.cls)} />
    <label ellipsize={Pango.EllipsizeMode.END} label={binding(active.title)} />
  </box>
)
