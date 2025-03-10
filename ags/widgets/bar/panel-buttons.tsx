import { Observable } from 'rx'
import GLib from 'gi://GLib?version=2.0'
import { binding, bindProp, obs } from 'rxbinding'
import { App, Gtk } from 'astal/gtk4'
import AstalNetwork from 'gi://AstalNetwork?version=0.1'
import { bind, Binding } from 'astal'
import AstalBattery from 'gi://AstalBattery?version=0.1'
import AstalPowerProfiles from 'gi://AstalPowerProfiles?version=0.1'
import { Box, Button, ButtonProps } from 'astal/gtk4/widget'
import AstalWp from 'gi://AstalWp?version=0.1'
import { SysTray } from './tray'

type PanelButtonProps = ButtonProps & {
  window?: string
}

const PanelButton = (
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
const time = Observable.interval(1000)
  .startWith(0)
  .map(() => {
    const time = GLib.DateTime.new_now_local()
    return {
      clock: time.format(clockFormat),
      date: time.format(dateFormat),
    }
  })
  .shareReplay(1)

const DateTime = () => (
  <PanelButton
    tooltipText={binding(time.map((t) => t.date))}
    cssClasses={['date-time']}
  >
    <label label={binding(time.map((t) => t.clock))} />
  </PanelButton>
)

const { wifi } = AstalNetwork.get_default()
const battery = AstalBattery.get_default()
const profiles = AstalPowerProfiles.get_default()

const isMuted = obs(AstalWp.get_default(), 'default_speaker').flatMapLatest(s => obs(s, 'mute'))

const wired = obs(AstalNetwork.get_default(), 'wired')
  .flatMapLatest(w => obs(w, 'state'))
  .shareReplay(1)

const ethIcon = wired.map(s => {
  switch (s) {
    case AstalNetwork.DeviceState.ACTIVATED: return "network-wired-symbolic"
    case AstalNetwork.DeviceState.IP_CHECK:
    case AstalNetwork.DeviceState.IP_CONFIG:
    case AstalNetwork.DeviceState.CONFIG:
    case AstalNetwork.DeviceState.SECONDARIES:
    case AstalNetwork.DeviceState.PREPARE: return "network-wired-acquiring-symbolic"
    case AstalNetwork.DeviceState.FAILED:
    case AstalNetwork.DeviceState.NEED_AUTH:
    case AstalNetwork.DeviceState.UNMANAGED:
    case AstalNetwork.DeviceState.UNKNOWN: return "network-wired-no-route-symbolic"
    default: return "network-wired-disconnected-symbolic"
  }
})

const ethEnabled = wired.map(s => s != AstalNetwork.DeviceState.DISCONNECTED)

const ethSpeed = obs(AstalNetwork.get_default(), 'wired')
  .flatMapLatest(w => obs(w, 'speed'))
  .map(s => s.toString())

export const PanelButtons = () => (
  <box>
    <SysTray />
    <PanelButton
      window="network-config"
      onClicked={() => App.toggle_window('network-config')}
    >
      <box>
        <image iconName="audio-volume-muted" visible={binding(isMuted)} />
        <image iconName={binding(ethIcon)} visible={binding(ethEnabled)} tooltipText={binding(ethSpeed)} />
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
    </PanelButton>
    <DateTime />
  </box>
)
