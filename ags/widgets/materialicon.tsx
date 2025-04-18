import { Gio, GLib, GObject, readFile } from "astal"
import { Icon } from "astal/gtk3/widget"
import { Gdk, Gtk } from "astal/gtk4"
import astalify, { type } from "astal/gtk4/astalify"
import GdkPixbuf from "gi://GdkPixbuf?version=2.0"
import Soup from "gi://Soup?version=3.0"
import { connect } from "rxjs"
import style from "style/style"

const TINTED_CLASS_NAME = "tinted"
const SIZE_REG_CLASS_NAME = "size-regular"
const SIZE_SMALL_CLASS_NAME = "size-small"
const SIZE_LARGE_CLASS_NAME = "size-large"

type IconStyle = {
  size: 20 | 24 | 40 | 48,
  style: "outlined" | "rounded" | "sharp"
  wght: 100 | 200 | 300 | 400 | 500 | 600 | 700
  grad: "N25" | "0" | "200"
  fill: boolean
}

export type MaterialIconProps = Gtk.Label.ConstructorProps & {
  icon: string,
  tinted: boolean
} & IconStyle

export const iconcache = Gio.file_new_for_path(GLib.get_user_cache_dir() + "/icons")
if (!iconcache.query_exists(null)) {
  iconcache.make_directory_with_parents(null)
}


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

  _sizeCls = "size-regular"

  constructor(props: Partial<MaterialIconProps>) {
    super(props)

    const theme =Gtk.IconTheme.get_for_display(this.get_display())
    if (theme.search_path.includes(iconcache.get_path())){
    theme.add_search_path(iconcache.get_path())
    }
    // this.set_size_request(this._style.size, this._style.size)
    this.add_css_class(this._sizeCls)
    // this.set_draw_func(this._draw)
  }

  //   private _draw = (
  //     w: Gtk.DrawingArea,
  //     cr: cairo.Context,
  //     width: number,
  //     height: number
  //   ): void => {
  //     const file = this.iconfile
  //     if (file == null) return
  //     const color = w.get_color()
  //     const hexcolor = rgba2hex(color.to_string())
  //     console.log(hexcolor)
  //
  //     const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
  // <svg version="1.1"
  //            xmlns="http://www.w3.org/2000/svg"
  //            xmlns:xi="http://www.w3.org/2001/XInclude"
  //            width="${width}"
  //            height="${height}">
  //         <style type="text/css">
  //           rect,circle,path {
  //             fill:#${hexcolor} !important;
  //           }
  //         </style>
  //         <xi:include href="data:text/xml;base64,`
  //     const encoded = GLib.base64_encode(file.load_contents(null)[1])
  //     const pb = GdkPixbuf.Pixbuf.new_from_stream(
  //       Gio.MemoryInputStream.new_from_bytes(new TextEncoder().encode(svg + encoded + `"/></svg>`)),
  //       null
  //     )
  //     const half = this._style.size / 2
  //
  //     Gdk.cairo_set_source_pixbuf(cr, pb, width / 2 - half, height / 2 - half)
  //     cr.paint()
  //   }

  iconfile = null

  _style: IconStyle = { size: 24, style: "rounded", fill: false, wght: 300, grad: "N25" }

  set icon(icon: string) {
    const [_, name] = fetchForProps(icon, this._style)
    this.iconName = name.replace(".svg", "")
    console.log(Gtk.IconTheme.get_for_display(this.get_display()).search_path)

    // this.queue_draw()
  }

  set style(style: IconStyle) {
    this._style = style
    // this.queue_draw()
  }


  set size(size: MaterialIconProps["size"]) {
    // this.remove_css_class(this._sizeCls)
    // switch (size) {
    //   case "regular": this._sizeCls = SIZE_REG_CLASS_NAME; break
    //   case "small": this._sizeCls = SIZE_SMALL_CLASS_NAME; break
    //   case "large": this._sizeCls = SIZE_LARGE_CLASS_NAME; break
    // }
    // this.add_css_class(this._sizeCls)

  }

  set tinted(tinted: boolean) {
    if (tinted) {
      this.add_css_class(TINTED_CLASS_NAME)
    } else {
      this.remove_css_class(TINTED_CLASS_NAME)
    }
  }
}

function rgba2hex(orig) {
  var a, isPercent,
    rgb = orig.replace(/\s/g, '').match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i),
    alpha = (rgb && rgb[4] || "").trim(),
    hex = rgb ?
      (rgb[1] | 1 << 8).toString(16).slice(1) +
      (rgb[2] | 1 << 8).toString(16).slice(1) +
      (rgb[3] | 1 << 8).toString(16).slice(1) : orig;

  if (alpha !== "") {
    a = alpha;
  } else {
    a = 1;
  }
  // multiply before convert to HEX
  a = ((a * 255) | 1 << 8).toString(16).slice(1)
  hex = hex + a;

  return hex;
}

function fetchForProps(
  name: string,
  props: IconStyle
): [Gio.File, string] {
  const dirPath = `${name}/materialsymbols${props.style}/`
  const iconName = iconFromStyle(name, props)
  const path = dirPath + iconName

  // const icondir = iconcache.get_child(dirPath)
  //
  // if (!icondir.query_exists(null)) {
  //   icondir.make_directory_with_parents(null)
  // }
  const iconFile = iconcache.get_child(iconName)

  if (iconFile.query_exists(null)) {
    console.log("already exists")
    return [iconFile, iconName]
  }
  const session = new Soup.Session()
  console.log("prepare fetch", path)
  const message = Soup.Message.new('GET', `https://raw.githubusercontent.com/google/material-design-icons/refs/heads/master/symbols/web/${path}`)
  const result = session.send(message, null)
  iconFile.create(null, null).splice_async(result, Gio.OutputStreamSpliceFlags.CLOSE_SOURCE & Gio.OutputStreamSpliceFlags.CLOSE_TARGET, 1, null, () => {
    console.log("fetched")
  })
  return [iconFile, iconName]
}

function iconFromStyle(name: string, style: IconStyle): string {
  let r = `${name}_`

  if (style.wght != 400) {
    r += `wght${style.wght}`
  }

  if (style.grad != "0") {
    r += `grad${style.grad}`
  }

  if (style.fill) {
    r += "fill1"
  }

  r += `_${style.size}px.svg`
  console.log("built name", r)
  return r
}


export const MaterialIcon = astalify<MaterialIconInternal, MaterialIconProps>(MaterialIconInternal)
