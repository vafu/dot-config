import { App } from "astal/gtk4"
import style from "./style.scss"
import Adw from "gi://Adw?version=1"
import Bar from "./widgets/windows/Bar"

App.start({
    css: style,
    main() {
        Adw.init()
        App.get_monitors().forEach(m => Bar(m))
    },
})

