import Astal from 'gi://Astal?version=4.0'
import { App, BindableChild, Gtk } from 'astal/gtk4'
import {
  ActionRow,
  Box,
  Button,
  ButtonProps,
  ClampScrollable,
  ExpanderRow,
  Icon,
  IconProps,
  Label,
  ListBox,
  SplitButton,
} from 'widgets'
import Adw from 'gi://Adw?version=1'
import AstalNetwork from 'gi://AstalNetwork?version=0.1'
import { binding, obs } from 'rxbinding'
import { bind, Binding } from '../../../../../../usr/share/astal/gjs'

const network = AstalNetwork.get_default()
const wifi = obs(network, 'wifi').shareReplay(1)
const ssid = wifi.flatMapLatest((w) => obs(w, 'ssid'))
const networks = wifi
  .flatMapLatest((w) => obs(w, 'accessPoints'))
  .map((a) => a.map((ap) => <ActionRow title={ap.ssid} />))

export default () => (
  <window
    visible={false}
    name="network-config"
    className="bar-dropdown"
    application={App}
    exclusivity={Astal.Exclusivity.EXCLUSIVE}
    anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
  >
    <Quicktoggles />
  </window>
)

function Quicktoggles() {
  return (
    <Box>
      <Box orientation={Gtk.Orientation.VERTICAL}>
        {toggles.filter((_, i) => i % 2 == 0)}
      </Box>
      <Box orientation={Gtk.Orientation.VERTICAL}>
        {toggles.filter((_, i) => i % 2 != 0)}
      </Box>
    </Box>
  )
}

type QuicktoggleProps = ButtonProps & {
  iconName?: string | Binding<String>
  onMainClick?: () => void
  onSideClick?: () => void
}

const Quicktoggle = ({
  iconName = '',
  label = '',
  ...rest
}: QuicktoggleProps) => (
  <Box className="linked">
    {
      new Button(
        {
          setup: (self) => {
            self.toggleClassName('suggested-action')
            self.toggleClassName('icon-button')
            self.toggleClassName('circular')
          },
          ...rest,
        },
        <Icon iconName={iconName} />,
        <Label label={label} />
      )
    }
    <Button iconName="go-next" className="suggested-action circular" />
  </Box>
)

const toggles = [
  <Quicktoggle
    iconName={bind(network.wifi, 'iconName')}
    label={binding(ssid)}
  />,
  <Quicktoggle
    iconName={bind(network.wifi, 'iconName')}
    label={binding(ssid)}
  />,
]
