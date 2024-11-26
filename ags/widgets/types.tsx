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
export class Button extends astalify(
    Gtk.Button,
    Gtk.Button.name,
    (widgets, self) => {
        self.set_child(<Box>{widgets}</Box>)
    }
) {
    static { GObject.registerClass({ GTypeName: "Button" }, this) }
    constructor(props?: ButtonProps, ...children: Array<BindableChild>) { super({ children, ...props } as any) }
}

export type IconProps = ConstructProps<Icon, Gtk.Image.ConstructorProps>
export class Icon extends astalify(
    Gtk.Image,
    Gtk.Image.name,
) {
    static { GObject.registerClass({ GTypeName: "Image" }, this) }
    constructor(props?: IconProps) { super({ ...props } as any) }
}

export type BoxProps = ConstructProps<Box, Gtk.Box.ConstructorProps>
export class Box extends astalify(
    Gtk.Box,
) {
    static { GObject.registerClass({ GTypeName: "Box" }, this) }
    constructor(props?: BoxProps, ...children: Array<BindableChild>) { super({ children, ...props } as any) }
}

export type CenterBoxProps = ConstructProps<CenterBox, Gtk.CenterBox.ConstructorProps>
export class CenterBox extends astalify(
    Gtk.CenterBox,
    Gtk.CenterBox.name,
    (widgets, self) => {
        if (widgets.length > 3) {
            throw Error("Cannot set > 3 widgets to centerbox, consider wrapping into more Boxes")
        }
        if (widgets[0]) {
            self.set_start_widget(widgets[0])
        }
        if (widgets[1]) {
            self.set_center_widget(widgets[1])
        }
        if (widgets[2]) {
            self.set_end_widget(widgets[2])
        }
    }
) {
    static { GObject.registerClass({ GTypeName: "CenterBox" }, this) }
    constructor(props?: CenterBoxProps, ...children: Array<BindableChild>) { super({ children, ...props } as any) }
}


