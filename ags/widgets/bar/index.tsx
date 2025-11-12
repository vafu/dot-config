import { Astal, Gdk, Gtk } from 'astal/gtk4'
import { MPRISWidget } from './mpris'
import { PomodoroWidget } from './pomodoro'
import { TabsCarousel } from './tabs_carousel'
import { WSMatrix } from './ws_carousel'
import { Tray } from './tray'
import {
  SysStats,
  DateTime,
  BatteryIndicator,
  EthIndicator,
  PowerProfilesIndicator,
  WifiIndicator,
} from './indicators'
import { BluetoothStatus } from './bt_status'
import { WindowTitle } from './windowtitle'

export default (gdkmonitor: Gdk.Monitor) => {
  return (
    <window
      visible={true}
      gdkmonitor={gdkmonitor}
      name="Bar"
      cssClasses={['bar']}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      keymode={Astal.Keymode.NONE}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
    >
      <centerbox>
        {/** left **/}
        <box>
          <SysStats cssClasses={['barblock']} />
          <PomodoroWidget cssClasses={['barblock']} />
          <MPRISWidget cssClasses={['barblock']} />
        </box>

        {/** center **/}
        <centerbox cssClasses={['barblock']} hexpand={true}>
          <WSMatrix monitor={gdkmonitor} />
          <WindowTitle />
        </centerbox>

        {/** right **/}
        <box>
          <box>
            <box cssClasses={['barblock']}>
              <Tray />
              <PowerProfilesIndicator />
              <BluetoothStatus />
              <EthIndicator />
              <WifiIndicator />
              <BatteryIndicator />
            </box>
            <DateTime cssClasses={['barblock']} />
          </box>
        </box>
      </centerbox>
    </window>
  )
}
