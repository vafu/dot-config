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
import { bind, Binding, Variable } from '../../../../../../usr/share/astal/gjs'

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
    <Box className="quicktoggle-container">
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
  enabled?: Binding<Boolean>
  iconName?: string | Binding<String>
  onExtra?: () => void
}

const Quicktoggle = ({
  iconName = '',
  label = '',
  ...rest
}: QuicktoggleProps) => {
  const classes = ['icon-button', 'circular']
  return (
    <Box className="linked">
      {
        new Button(
          {
            onClicked: rest.onMainClicked,
            css_classes: rest.enabled.as((e) => [
              e ? 'suggested-action' : '',
              ...classes,
            ]),
            ...rest,
          },
          <Icon iconName={iconName} />,
          <Label label={label} />
        )
      }
      <Button
        iconName="go-next"
        css_classes={rest.enabled.as((e) => [
          e ? 'suggested-action' : '',
          ...classes,
        ])}
      />
    </Box>
  )
}

const wifiEnabled = wifi.flatMapLatest((w) => obs(w, 'enabled'))

const toggles = [
  <Quicktoggle
    enabled={binding(wifiEnabled)}
    onClicked={() =>
      network.get_wifi().set_enabled(!network.get_wifi().get_enabled())
    }
    iconName={bind(network.wifi, 'iconName')}
    label={binding(ssid)}
  />,
]
