import { Astal, Gdk, Gtk } from 'ags/gtk4'
import { MPRISWidget } from './mpris'
import { PomodoroWidget } from './pomodoro'
import { WSMatrix } from './ws_matrix'
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
import { ProjectsWidget } from './locus'
import { AudioVolumeIndicator } from './audio_route'

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
        Astal.WindowAnchor.BOTTOM |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
    >
      <centerbox>
        {/** left **/}
        <box $type="start">
          <ProjectsWidget monitor={gdkmonitor} />
          {/**  
          <PomodoroWidget cssClasses={['barblock']} />
          **/}
        </box>

        {/** center **/}
        <box
          cssClasses={['barblock']}
          hexpand={true}
          homogeneous={true}
          $type="center"
        >
          <WSMatrix monitor={gdkmonitor} />
          <WindowTitle />
          <box />
        </box>

        {/** right **/}
        <box $type="end">
          <MPRISWidget cssClasses={['barblock']} />
          <SysStats cssClasses={['barblock']} />
          <box cssClasses={['barblock']}>
            <Tray />
            <PowerProfilesIndicator />
            <BluetoothStatus />
            <AudioVolumeIndicator />
            <EthIndicator />
            <WifiIndicator />
            <BatteryIndicator />
          </box>
          <DateTime cssClasses={['barblock']} />
        </box>
      </centerbox>
    </window>
  )
}
