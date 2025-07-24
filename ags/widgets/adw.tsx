import { astalify, Gtk } from 'astal/gtk4'
import Adw from 'gi://Adw?version=1'

export const ActionRow = astalify<
  Adw.ActionRow,
  Adw.ActionRow.ConstructorProps
>(Adw.ActionRow, {
  setChildren(self, children) {
    const a = children.flat(Infinity)[0]
    self.add_suffix(a)
  },
})

export const ListBox = astalify<Gtk.ListBox, Gtk.ListBox.ConstructorProps>(
  Gtk.ListBox,
  {
    setChildren(self, children) {
      let child = self.get_row_at_index(0)
      while (child) {
        self.remove(child)
        child = self.get_row_at_index(0)
      }

      children.flat(Infinity).forEach((w) => {
        if (w instanceof Gtk.Widget) {
          self.append(w)
        }
      })
    },
  }
)

export const ExpanderRow = astalify<
  Adw.ExpanderRow,
  Adw.ExpanderRow.ConstructorProps
>(Adw.ExpanderRow, {
  setChildren(self, children) {
    children.forEach((w) => self.add_row(w))
  },
})
