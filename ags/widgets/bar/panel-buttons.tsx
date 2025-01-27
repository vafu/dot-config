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

const isMuted = obs(AstalWp.get_default(), 'default_speaker').flatMapLatest(
  (s) => obs(s, 'mute')
)

export const PanelButtons = () => (
  <box>
    <PanelButton
      window="network-config"
      onClicked={() => App.toggle_window('network-config')}
    >
      <box>
        <image iconName="audio-volume-muted" visible={binding(isMuted)} />
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
