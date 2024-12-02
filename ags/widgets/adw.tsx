import { astalify, type ConstructProps, Gtk, BindableChild } from 'astal/gtk4'
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
export class ListBox extends astalify(Gtk.ListBox) {
  static {
    GObject.registerClass({ GTypeName: 'ListBox' }, this)
  }
  constructor(props?: ListBoxProps, ...children: Array<BindableChild>) {
    super({ children, ...props } as any)
  }
}
