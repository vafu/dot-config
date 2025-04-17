import { GObject } from "astal"
import { Gtk } from "astal/gtk4"
import astalify, { type } from "astal/gtk4/astalify"

const TINTED_CLASS_NAME = "tinted"
const SIZE_REG_CLASS_NAME = "size-regular"
const SIZE_SMALL_CLASS_NAME = "size-small"
const SIZE_LARGE_CLASS_NAME = "size-large"

export type MaterialIconProps = Gtk.Label.ConstructorProps & {
  icon: string,
  size: "regular" | "small" | "large"
  tinted: boolean
}

class MaterialIconInternal extends Gtk.Label {

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

    this.add_css_class(this._sizeCls)
  }

  set icon(icon: string) {
    this.label = icon
  }


  set size(size: MaterialIconProps["size"]) {
    this.remove_css_class(this._sizeCls)
    switch (size) {
      case "regular": this._sizeCls = SIZE_REG_CLASS_NAME; break
      case "small": this._sizeCls = SIZE_SMALL_CLASS_NAME; break
      case "large": this._sizeCls = SIZE_LARGE_CLASS_NAME; break
    }
    this.add_css_class(this._sizeCls)
  }

  set tinted(tinted: boolean) {
    if (tinted) {
      this.add_css_class(TINTED_CLASS_NAME)
    } else {
      this.remove_css_class(TINTED_CLASS_NAME)
    }
  }
}

export const MaterialIcon = astalify<MaterialIconInternal, MaterialIconProps>(MaterialIconInternal)
