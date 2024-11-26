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
