import { astalify, type ConstructProps, Gtk } from 'astal/gtk4'
import Adw from 'gi://Adw?version=1'
import { type } from '../../../../../usr/share/astal/gjs/gtk4/astalify'

export type ActionRowProps = ConstructProps<
  Adw.ActionRow,
  Adw.ActionRow.ConstructorProps
>
export const ActionRow = astalify<
  Adw.ActionRow,
  Adw.ActionRow.ConstructorProps
>(Adw.ActionRow, {
  setChildren(self, children) {
    const a = children.flat(Infinity)[0]
    self.add_suffix(a)
  },
})

const id = (() => {
  let currentId = 0
  const map = new WeakMap()

  return (object) => {
    if (!map.has(object)) {
      map.set(object, ++currentId)
    }

    return map.get(object)
  }
})()

export type ListBoxProps = ConstructProps<
  Gtk.ListBox,
  Gtk.ListBox.ConstructorProps
>
export const ListBox = astalify<Gtk.ListBox, Gtk.ListBox.ConstructorProps>(
  Gtk.ListBox,
  {
    setChildren(self, children) {
      self.remove_all()
      children.flat(Infinity).forEach((w) => {
        if (w instanceof Gtk.Widget) {
          self.append(w)
        }
      })
    },
  }
)

export type ExpanderRowProps = ConstructProps<
  Adw.ExpanderRow,
  Adw.ExpanderRow.ConstructorProps
>
export const ExpanderRow = astalify<
  Adw.ExpanderRow,
  Adw.ExpanderRow.ConstructorProps
>(Adw.ExpanderRow, {
  setChildren(self, children) {
    // let c = self.get_last_child()
    // while (c != null) {
    //   self.remove(c)
    //   c = self.get_last_child()
    // }
    children.forEach((w) => self.add_row(w))
  },
})
