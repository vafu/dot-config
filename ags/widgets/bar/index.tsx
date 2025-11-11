import { Astal, Gdk, Gtk } from 'astal/gtk4'
import { MPRISWidget } from './mpris'
import { PomodoroWidget } from './pomodoro'
import { TabsCarousel } from './tabs_carousel'
import { WSCarousel } from './ws_carousel'
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
          <WSCarousel monitor={gdkmonitor} cssClasses={['barblock']} />
          <SysStats cssClasses={['barblock']} />
          <MPRISWidget cssClasses={['barblock']} />
        </box>

        {/** center **/}
        <TabsCarousel monitor={gdkmonitor} cssClasses={['barblock']} />

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
            <PomodoroWidget cssClasses={['barblock']} />
            <DateTime cssClasses={['barblock']} />
          </box>
        </box>
      </centerbox>
    </window>
  )
}
