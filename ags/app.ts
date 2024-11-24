import { App } from "astal/gtk4"
import Adw from "gi://Adw?version=1"
import Bar from "./widgets/windows/Bar"
import style from "./style/style"

App.start({
    css: style,
    main() {
        Adw.init()
        App.get_monitors().forEach(m => Bar(m))
    },
})

