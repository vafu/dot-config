import Pango from 'gi://Pango?version=1.0'
import { binding } from 'rxbinding'
import { Gtk } from 'ags/gtk4'
import { getLocusService } from 'services/locus'
import { WidgetProps } from 'widgets'

const title = getLocusService().selectedWindowTitle$

export const WindowTitle = (props: WidgetProps) => (
  <label
    halign={Gtk.Align.CENTER}
    maxWidthChars={50}
    cssClasses={(props.cssClasses ?? []).concat(['window-title'])}
    ellipsize={Pango.EllipsizeMode.END} label={binding(title, '')} />
)
