import { interval, map, shareReplay, startWith } from 'rxjs'
import GLib from 'gi://GLib?version=2.0'
import {
  bindAs,
  binding,
  bindString,
  fromChain as chain,
  fromConnectable,
} from 'rxbinding'
import { Gtk } from 'astal/gtk4'
import AstalNetwork from 'gi://AstalNetwork?version=0.1'
import { bind, exec } from 'astal'
import AstalBattery from 'gi://AstalBattery?version=0.1'
import AstalPowerProfiles from 'gi://AstalPowerProfiles?version=0.1'
import { Button, ButtonProps, MenuButton, Popover } from 'astal/gtk4/widget'
import AstalWp from 'gi://AstalWp?version=0.1'
import { SysTray } from './tray'
import { QuicktoggleMenu } from 'widgets/bar_dropdown'
import { PomodoroWidget } from './pomodoro'

type PanelButtonProps = ButtonProps & {
  window?: string
}

export const PanelButton = (
  { window = '', ...rest }: PanelButtonProps,
  child: Gtk.Widget
) =>
  Button({
    setup: (self) => {
      self.add_css_class('panel-button')
      self.add_css_class('flat')
      self.add_css_class('pill')
      self.add_css_class('bar-widget')
    },
    child: child,
    ...rest,
  })

const dateFormat = '%a %b %d'
const clockFormat = `${dateFormat} %H:%M`
const time = interval(1000).pipe(
  startWith(0),
  map(() => {
    const time = GLib.DateTime.new_now_local()
    return {
      clock: time.format(clockFormat),
      date: time.format(dateFormat),
    }
  }),
  shareReplay(1)
)

const DateTime = () => (
  <PanelButton
    tooltipText={bindAs(time, (t) => t.date)}
    cssClasses={['date-time']}
    onClicked={() => exec(["swaync-client", "-t"])}
  >
    <label label={bindAs(time, (t) => t.clock)} />
  </PanelButton>
)

const { wifi } = AstalNetwork.get_default()
const battery = AstalBattery.get_default()
const profiles = AstalPowerProfiles.get_default()

const isMuted = chain(
  fromConnectable(AstalWp.get_default(), 'default_speaker'),
  'mute'
)

const wired = chain(
  fromConnectable(AstalNetwork.get_default(), 'wired'),
  'state'
)

const ethIcon = wired.pipe(
  map((s) => {
    switch (s) {
      case AstalNetwork.DeviceState.ACTIVATED:
        return 'network-wired-symbolic'
      case AstalNetwork.DeviceState.IP_CHECK:
      case AstalNetwork.DeviceState.IP_CONFIG:
      case AstalNetwork.DeviceState.CONFIG:
      case AstalNetwork.DeviceState.SECONDARIES:
      case AstalNetwork.DeviceState.PREPARE:
        return 'network-wired-acquiring-symbolic'
      case AstalNetwork.DeviceState.FAILED:
      case AstalNetwork.DeviceState.NEED_AUTH:
      case AstalNetwork.DeviceState.UNMANAGED:
      case AstalNetwork.DeviceState.UNKNOWN:
        return 'network-wired-no-route-symbolic'
      default:
        return 'network-wired-disconnected-symbolic'
    }
  })
)

const ethEnabled = wired.pipe(
  map((s) => s != AstalNetwork.DeviceState.DISCONNECTED)
)

const ethSpeed = chain(
  fromConnectable(AstalNetwork.get_default(), 'wired'),
  'speed'
)

export const PanelButtons = () => (
  <box>
    <PomodoroWidget/>
    <SysTray />
    <MenuButton cssClasses={["panel-button", "flat", "pill", "bar-widget"]} >
      <box>
        <image iconName="audio-volume-muted" visible={binding(isMuted)} />
        <image
          iconName={binding(ethIcon)}
          visible={binding(ethEnabled)}
          tooltipText={bindString(ethSpeed)}
        />
        <image
          tooltipText={bind(profiles, 'active_profile')}
          iconName={bind(profiles, 'iconName')}
          visible={bind(profiles, 'active_profile').as((p) => p != 'balanced')}
        />
        <image
          tooltipText={bind(wifi, 'ssid').as(String)}
          iconName={bind(wifi, 'iconName')}
        />
        <image
          tooltipText={bind(battery, 'percentage').as(String)}
          iconName={bind(battery, 'battery_icon_name')}
        />
      </box>
      <Popover onKeyPressed={(_, k) => console.log(k)}>
        <QuicktoggleMenu />
      </Popover>
    </MenuButton>
    <DateTime />
  </box>
)
