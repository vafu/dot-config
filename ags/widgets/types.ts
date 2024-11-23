import { astalify, type ConstructProps, Gtk, BindableChild } from "astal/gtk4"
import GObject from "gi://GObject?version=2.0"

export type LabelProps = ConstructProps<Label, Gtk.Label.ConstructorProps>
export class Label extends astalify(Gtk.Label) {
    static { GObject.registerClass({ GTypeName: "Label" }, this) }
    constructor(props?: LabelProps) { super(props as any) }
}


export type ButtonProps = ConstructProps<Button, Gtk.Button.ConstructorProps, {
    onClicked: [],
}>
export class Button extends astalify(Gtk.Button) {
    static { GObject.registerClass({ GTypeName: "Button" }, this) }
    constructor(props?: ButtonProps) { super({ ...props } as any) }
}

export type BoxProps = ConstructProps<Box, Gtk.Box.ConstructorProps>
export class Box extends astalify(
    Gtk.Box,
) {
    static { GObject.registerClass({ GTypeName: "Box" }, this) }
    constructor(props?: BoxProps, ...children: Array<BindableChild>) { super({ children, ...props } as any) }
}

