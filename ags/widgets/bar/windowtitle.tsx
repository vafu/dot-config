import Pango from 'gi://Pango?version=1.0'
import { binding } from 'rxbinding'
import { Gtk } from 'astal/gtk4'
import obtainWmService from 'services'
import { switchMap } from 'rxjs'
import { WidgetProps } from 'widgets'

const active = (await obtainWmService('window')).active
const cls = active.pipe(switchMap(a => a.cls))
const title = active.pipe(switchMap(a => a.title))

export const WindowTitle = (props: WidgetProps) => (
  <label
    halign={Gtk.Align.CENTER}
    maxWidthChars={50}
    cssClasses={(props.cssClasses ?? []).concat(['window-title'])}
    ellipsize={Pango.EllipsizeMode.END} label={binding(title)} />
)
