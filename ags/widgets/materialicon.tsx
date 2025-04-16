import { Gtk } from "astal/gtk4"

export type MaterialIconProps = Gtk.Label.ConstructorProps & {
  icon: string,
  size: "regular" | "small" | "large"
}
export function MaterialIcon(props: Partial<MaterialIconProps>) {
  const { icon, size, ...rest } = props
  const w = new Gtk.Label({
    ...rest,
    label: icon ?? "unknown"
  })

  w.add_css_class("material-icon")
  w.add_css_class(size ?? "regular")

  return w
}
