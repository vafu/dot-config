import { GObject, property, register } from "astal";

export class WindowService {

    activeWindow = new ActiveWindow()
}

@register()
export class ActiveWindow extends GObject.Object {

    @property(String)
    declare cls : string

    @property(String)
    declare title : string
}
