import { Observable } from 'rx'
import GLib from 'gi://GLib?version=2.0'
import { binding } from 'rxbinding'
import { Box, Button, ButtonProps, Icon, Label } from 'widgets'
import { App, BindableChild } from 'astal/gtk4'
import AstalNetwork from 'gi://AstalNetwork?version=0.1'
import { bind } from 'astal'

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
        self.toggleClassName('bar-widget')
      },
      ...rest,
    },
    ...children
  )

const clockFormat = '%H:%M'
const dateFormat = '%a %y %b'
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

function Wifi() {
  const { wifi } = AstalNetwork.get_default()

  return (
    <PanelButton
      window="network-config"
      onClicked={() => App.toggle_window('network-config')}
      tooltipText={bind(wifi, 'ssid').as(String)}
    >
      <Icon className="Wifi" iconName={bind(wifi, 'iconName')} />
    </PanelButton>
  )
}

export const PanelButtons = () => (
  <Box>
    <Wifi />
    <DateTime />
  </Box>
)

// http://google.com
