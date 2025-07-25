import Pango from 'gi://Pango?version=1.0'
import Service from 'services'
import { binding } from 'rxbinding'
import { Binding } from 'astal'
import { Gtk } from 'astal/gtk4'

const active = Service('window').active

export const WindowTitle = (props: { visible: Binding<boolean> }) => (
  <box cssClasses={['window-title', 'bar-widget']} visible={props.visible} halign={Gtk.Align.CENTER}>
    <label cssClasses={['cls']} label={binding(active.cls)} />
    <label ellipsize={Pango.EllipsizeMode.END} label={binding(active.title)} />
  </box>
)
