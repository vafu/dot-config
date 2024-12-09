import { Observable } from 'rx'
import GLib from 'gi://GLib?version=2.0'
import { binding } from 'rxbinding'
import { Box, Button, ButtonProps, Icon, Label } from 'widgets'
import { App, BindableChild } from 'astal/gtk4'
import AstalNetwork from 'gi://AstalNetwork?version=0.1'
import { bind, Binding } from 'astal'
import AstalBattery from 'gi://AstalBattery?version=0.1'
import AstalPowerProfiles from 'gi://AstalPowerProfiles?version=0.1'

type PanelButtonProps = ButtonProps & {
  window?: string
}

const PanelButton = (
  { window = '', ...rest }: PanelButtonProps,
  ...children: Array<BindableChild>
) =>
  new Button(
    {
      setup: (self) => {
        self.toggleClassName('panel-button')
        self.toggleClassName('flat')
        self.toggleClassName('pill')
        self.toggleClassName('bar-widget')
      },
      ...rest,
    },
    ...children
  )

const clockFormat = '%H:%M'
const dateFormat = '%a %d %b'
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
    className="date-time"
  >
    <Label label={binding(time.map((t) => t.clock))} />
  </PanelButton>
)

const { wifi } = AstalNetwork.get_default()
const battery = AstalBattery.get_default()
const profiles = AstalPowerProfiles.get_default()

export const PanelButtons = () => (
  <Box>
    <PanelButton
      window="network-config"
      onClicked={() => App.toggle_window('network-config')}
    >
      <Icon
        tooltipText={bind(profiles, 'active_profile')}
        iconName={bind(profiles, 'iconName')}
        visible={bind(profiles, 'active_profile').as((p) => p != 'balanced')}
      />
      <Icon
        tooltipText={bind(wifi, 'ssid').as(String)}
        iconName={bind(wifi, 'iconName')}
      />
      <Icon
        tooltipText={bind(battery, 'percentage').as(String)}
        iconName={bind(battery, 'battery_icon_name')}
      />
    </PanelButton>
    <DateTime />
  </Box>
)
