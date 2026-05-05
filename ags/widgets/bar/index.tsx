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
  MutedIndicator,
} from './indicators'
import { BluetoothStatus } from './bt_status'
import { WindowTitle } from './windowtitle'
import { AgentWidgets } from './agent'
import { LocusProjectWidget } from './locus'

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
          <LocusProjectWidget cssClasses={['barblock']} />
          {/**  
          <PomodoroWidget cssClasses={['barblock']} />
          **/}
          <AgentWidgets cssClasses={['barblock']} />
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
            <MutedIndicator />
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
