import { astalify, type ConstructProps, Gtk, BindableChild } from 'astal/gtk4'
import Adw1 from 'gi://Adw'
import Adw from 'gi://Adw?version=1'
import GObject from 'gi://GObject?version=2.0'

export type ActionRowProps = ConstructProps<
  ActionRow,
  Adw.ActionRow.ConstructorProps
>
export class ActionRow extends astalify(Adw.ActionRow) {
  static {
    GObject.registerClass({ GTypeName: 'ActionRow' }, this)
  }
  constructor(props?: ActionRowProps) {
    super(props as any)
  }
}

export type ListBoxProps = ConstructProps<ListBox, Gtk.ListBox.ConstructorProps>
export class ListBox extends astalify(
  Gtk.ListBox,
  Gtk.ListBox.name,
  (children, self) => {
    self.remove_all()
    children.forEach((w) => self.append(w))
  }
) {
  static {
    GObject.registerClass({ GTypeName: 'ListBox' }, this)
  }
  constructor(props?: ListBoxProps, ...children: Array<BindableChild>) {
    super({ children, ...props } as any)
  }
}

export type ExpanderRowProps = ConstructProps<
  ExpanderRow,
  Adw.ExpanderRow.ConstructorProps
>
export class ExpanderRow extends astalify(
  Adw.ExpanderRow,
  Adw.ExpanderRow.name,
  (children, self) => {
    // let c = self.get_last_child()
    // while (c != null) {
    //   self.remove(c)
    //   c = self.get_last_child()
    // }
    children.forEach((w) => self.add_row(w))
  }
) {
  static {
    GObject.registerClass({ GTypeName: 'ExpanderRow' }, this)
  }
  constructor(props?: ExpanderRowProps, ...children: Array<BindableChild>) {
    super({ children, ...props } as any)
  }
}
