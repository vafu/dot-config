import { execAsync } from 'ags/process'
import Gio from 'gi://Gio?version=2.0'
import GLib from 'gi://GLib?version=2.0'
import GObject from 'gi://GObject?version=2.0'
import { Gtk } from 'ags/gtk4'
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
  style: Partial<IconStyle>
}

const themedir = Gio.file_new_for_path(
  GLib.get_user_data_dir() + '/icons/Material/',
)
export const iconcache = themedir.get_child('symbolic')

class MaterialIconInternal extends Gtk.Image {
  static {
    GObject.registerClass(
      {
        GTypeName: 'MaterialIcon',
        CssName: 'materialicon',
      },
      this,
    )
  }

  constructor(props: Partial<MaterialIconProps> = {}) {
    // Extract custom props that don't belong to Gtk.Image
    // Also extract JSX special props like 'setup' and '$'
    const { icon, tinted, style, setup, $, ...imageProps } = props as any
    super(imageProps)
    
    // Initialize after parent constructor
    if (icon) this.icon = icon
    if (tinted !== undefined) this.tinted = tinted
    if (style) this.style = style
    
    // Handle setup callback (AGS v2) or $ callback (AGS v3)
    const setupFn = $ || setup
    if (setupFn) {
      setupFn(this)
    }
  }

  _style: IconStyle = {
    size: 24,
    style: 'outlined',
    wght: 400,
    grad: '0',
    fill: true,
  }

  _icon = ''

  set icon(icon: string) {
    this._icon = icon
    fetchForProps(icon, this._style, name => {
      this.set_from_icon_name(name)
    })
  }

  set style(style: Partial<IconStyle>) {
    this._style = {
      ...this._style,
      ...style,
    }
    this.icon = this._icon
  }

  set tinted(tinted: boolean) {
    if (tinted) {
      this.add_css_class(TINTED_CLASS_NAME)
    } else {
      this.remove_css_class(TINTED_CLASS_NAME)
    }
  }
}

function fetchForProps(
  name: string,
  props: IconStyle,
  onResolved: (name: string) => void,
) {
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
  const message = Soup.Message.new(
    'GET',
    `https://raw.githubusercontent.com/google/material-design-icons/refs/heads/master/symbols/web/${path}.svg`,
  )

  session.send_and_read_async(
    message,
    GLib.PRIORITY_DEFAULT,
    null,
    async (session, result) => {
      try {
        let bytes = session.send_and_read_finish(result)
        if (!bytes) {
          throw new Error('Failed to download icon, received no bytes.')
        }

        const decoder = new TextDecoder('utf-8')
        let svgContent = decoder.decode(bytes.get_data())

        if (svgContent.includes('viewBox="0 -960 960 960"')) {
          svgContent = svgContent.replace(
            'viewBox="0 -960 960 960"',
            'viewBox="0 0 960 960"',
          )

          svgContent = svgContent.replace(
            /<path /g,
            '<path transform="translate(0, 960)" ',
          )
          const encoder = new TextEncoder()
          bytes = new GLib.Bytes(encoder.encode(svgContent))
        }

        iconFile.replace_contents_bytes_async(
          bytes,
          null,
          false,
          Gio.FileCreateFlags.NONE,
          null,
          async (file, res) => {
            try {
              file.replace_contents_finish(res)
              await execAsync(`gtk-update-icon-cache -f ${themedir.get_path()}`)
              GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                onResolved(iconName)
                return GLib.SOURCE_REMOVE
              })
            } catch (e) {
              console.error(`Failed to save icon or update cache: ${e}`)
            }
          },
        )
      } catch (e) {
        console.error(`Failed to fetch or process icon ${iconName}: ${e}`)
      }
    },
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

export const MaterialIcon = MaterialIconInternal
