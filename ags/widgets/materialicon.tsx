import { exec, Gio, GLib, GObject } from 'astal'
import { Gtk } from 'astal/gtk4'
import astalify from 'astal/gtk4/astalify'
import Soup from 'gi://Soup?version=3.0'

const TINTED_CLASS_NAME = 'tinted'

type IconStyle = {
  size: 20 | 24 | 40 | 48
  style: 'outlined' | 'rounded' | 'sharp'
  wght: 100 | 200 | 300 | 400 | 500 | 600 | 700
  grad: 'N25' | '0' | '200'
  fill: boolean
}

export type MaterialIconProps = Gtk.Label.ConstructorProps & {
  icon: string
  tinted: boolean
} & IconStyle

const themedir = Gio.file_new_for_path(
  GLib.get_user_data_dir() + '/icons/Material/'
)
export const iconcache = themedir.get_child('symbolic')

class MaterialIconInternal extends Gtk.Image {
  static {
    GObject.registerClass(
      {
        GTypeName: 'MaterialIcon',
        CssName: 'materialicon',
      },
      this
    )
  }

  constructor(props: Partial<MaterialIconProps>) {
    super(props)
  }

  _style: IconStyle = {
    size: 48,
    style: 'outlined',
    fill: true,
    wght: 400,
    grad: '0',
  }

  set icon(icon: string) {
    fetchForProps(icon, this._style, (name) => {
      console.log(name)
      this.iconName = name
      this.queue_draw()
    })
  }

  set style(style: IconStyle) {
    this._style = style
    // this.queue_draw()
  }

  set tinted(tinted: boolean) {
    if (tinted) {
      this.add_css_class(TINTED_CLASS_NAME)
    } else {
      this.remove_css_class(TINTED_CLASS_NAME)
    }
  }
}

function fetchForProps(name: string, props: IconStyle, onResolved: (name: string) => void) {
  const resourceName = iconFromStyle(name, props)
  const iconName = `${resourceName}-${props.style}-symbolic`
  const iconFile = iconcache.get_child(iconName + '.svg')

  if (iconFile.query_exists(null)) {
    onResolved(iconName)
    return
  }
  const remotedir = `${name}/materialsymbols${props.style}/`
  const path = remotedir + resourceName
  const session = new Soup.Session()
  console.log('fetching', path)
  const message = Soup.Message.new(
    'GET',
    `https://raw.githubusercontent.com/google/material-design-icons/refs/heads/master/symbols/web/${path}.svg`
  )
  const result = session.send(message, null)
  iconFile
    .create(null, null)
    .splice_async(
      result,
      Gio.OutputStreamSpliceFlags.CLOSE_SOURCE &
      Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
      1,
      null,
      () => {
        exec(`gtk-update-icon-cache ${themedir.get_path()}`)
        onResolved(iconName)
      }
    )
}

function iconFromStyle(name: string, style: IconStyle): string {
  let r = `${name}_`

  if (style.wght != 400) {
    r += `wght${style.wght}`
  }

  if (style.grad != '0') {
    r += `grad${style.grad}`
  }

  if (style.fill) {
    r += 'fill1'
  }

  if (!r.endsWith('_')) r += '_'
  r += `${style.size}px`
  return r
}

export const MaterialIcon = astalify<MaterialIconInternal, MaterialIconProps>(
  MaterialIconInternal
)
