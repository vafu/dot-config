import { Gtk } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'

// In AGS v3, widgets can be used directly in JSX without astalify.
// For widgets with custom child management, we create wrapper functions
// that handle the special logic.

// ActionRow - add children as suffix
export function ActionRow(props: Partial<Adw.ActionRow.ConstructorProps> & { children?: Gtk.Widget[] }) {
  const { children, ...rest } = props
  const row = new Adw.ActionRow(rest)
  
  if (children) {
    const child = children.flat(Infinity)[0]
    if (child) {
      row.add_suffix(child)
    }
  }
  
  return row
}

// ListBox - append children as rows
export function ListBox(props: Partial<Gtk.ListBox.ConstructorProps> & { children?: Gtk.Widget[] }) {
  const { children, ...rest } = props
  const listBox = new Gtk.ListBox(rest)
  
  if (children) {
    children.flat(Infinity).forEach((w) => {
      if (w instanceof Gtk.Widget) {
        listBox.append(w)
      }
    })
  }
  
  return listBox
}

// ExpanderRow - add children as rows
export function ExpanderRow(props: Partial<Adw.ExpanderRow.ConstructorProps> & { children?: Gtk.Widget[] }) {
  const { children, ...rest } = props
  const row = new Adw.ExpanderRow(rest)
  
  if (children) {
    children.forEach((w) => {
      if (w instanceof Gtk.Widget) {
        row.add_row(w)
      }
    })
  }
  
  return row
}

// CarouselIndicatorDots - no special children handling
export const CarouselIndicatorDots = Adw.CarouselIndicatorDots
