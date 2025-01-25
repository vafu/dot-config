import { App, Astal, Gdk } from "astal/gtk4"
import { OnScreenProgress } from "./OSD"
import Brightness from "./brightness"
import { obs } from "rxbinding"

const brightness = obs(Brightness.get_default(), 'screen')
  .map(b => ({
    type: 'level',
    value: b,
    iconName: 'display-brightness-symbolic'
  }))


export default function OSD(monitor: Gdk.Monitor) {

  return (
    <window
      visible={true}
      gdkmonitor={monitor}
      cssClasses={["OSD"]}
      namespace="osd"
      application={App}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.ON_DEMAND}
      anchor={Astal.WindowAnchor.BOTTOM}
    >
      <OnScreenProgress states={brightness} />
    </window>
  )
}

