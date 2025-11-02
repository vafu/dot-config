import Pango from 'gi://Pango?version=1.0'
import { binding } from 'rxbinding'
import { Gtk } from 'astal/gtk4'
import obtainWmService from 'services'
import { switchMap } from 'rxjs'

const active = (await obtainWmService('window')).active
const cls = active.pipe(switchMap(a => a.cls))
const title = active.pipe(switchMap(a => a.title))

export const WindowTitle = () => (
  <box cssClasses={['window-title', 'bar-widget']} halign={Gtk.Align.CENTER}>
    <label cssClasses={['cls']} label={binding(cls)} />
    <label ellipsize={Pango.EllipsizeMode.END} label={binding(title)} />
  </box>
)
