import { bind } from "astal"
import Tray from "gi://AstalTray"
import { binding, obs } from "rxbinding"

export function SysTray() {
  const tray = Tray.get_default()

  return <box cssClasses={["SysTray"]} >
    {
      binding(obs(tray, "items").map(items => items.map(item => {
        console.log("item", item)
        return <menubutton
          cssClasses={["flat", "bar-widget"]}
          tooltipMarkup={bind(item, "tooltipMarkup")}
          actionGroup={bind(item, "actionGroup").as(ag => ["dbusmenu", ag])}
          menuModel={bind(item, "menuModel")}
          setup={w => {
            const c = bind(item, "actionGroup").subscribe(ag => {
              w.insert_action_group("dbusmenu", null)
              w.insert_action_group("dbusmenu", ag)
            }
            )
            w.connect("destroy", c)
          }}
        >
          <image gicon={bind(item, "gicon")} />
        </menubutton>
      })))
    }
  </box >
}
