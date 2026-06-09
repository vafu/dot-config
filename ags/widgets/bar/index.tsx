import { Astal, Gdk, Gtk } from 'ags/gtk4'
import { MPRISWidget } from './mpris'
import { PomodoroWidget } from './pomodoro'
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
import { WorkspacesWidget } from './locus'
import { AudioVolumeIndicator } from './audio_route'
import { WorkspaceWindowIndicators } from './window_indicators'
import { BzBusWidget } from './bzbus'

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
          <WorkspacesWidget monitor={gdkmonitor} />
          {/**  
          <PomodoroWidget cssClasses={['barblock']} />
          **/}

          <BzBusWidget cssClasses={['barblock']} />
        </box>

        {/** center **/}
        <box
          halign={Gtk.Align.CENTER}
          $type="center"
        >
          <WorkspaceWindowIndicators monitor={gdkmonitor} />
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
