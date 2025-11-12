import { bind, execAsync, GLib, Variable } from 'astal'
import { DualIndicator, IconIndicator, PanelButton } from './panel-widgets'
import { interval, map, shareReplay, startWith } from 'rxjs'
import AstalBattery from 'gi://AstalBattery?version=0.1'
import AstalNetwork from 'gi://AstalNetwork?version=0.1'
import AstalPowerProfiles from 'gi://AstalPowerProfiles?version=0.1'
import AstalWp from 'gi://AstalWp?version=0.1'
import {
  bindAs,
  fromConnectable,
  fromJsonProcess,
  binding,
  bindString,
  fromChain,
} from 'rxbinding'
import { MaterialIcon } from 'widgets/materialicon'
import { WidgetProps } from 'widgets'

const CPU = Variable('0').poll(
  3000,
  async () => await execAsync('bash scripts/cpu.sh'),
)
const RAM = Variable('0').poll(
  3000,
  async () => await execAsync('bash scripts/ram.sh'),
)

const stages = [
  { level: 0, class: 'normal' },
  { level: 35, class: 'warn' },
  { level: 50, class: 'high' },
  { level: 80, class: 'danger' },
  { level: 90, class: 'critical' },
]

export const SysStats = (props: WidgetProps) => (
  <DualIndicator
    icon="memory"
    stages={stages}
    left={CPU().as(v => parseInt(v))}
    right={RAM().as(v => parseInt(v))}
    levelsVisible={true}
    cssClasses={props.cssClasses}
  />
)

const dateFormat = '%a %b %d'
const clockFormat = `%H:%M`
const time = interval(1000).pipe(
  startWith(0),
  map(() => {
    const time = GLib.DateTime.new_now_local()
    return {
      clock: time.format(clockFormat),
      date: time.format(dateFormat),
    }
  }),
  shareReplay(1),
)

export const DateTime = (props: WidgetProps) => (
  <PanelButton
    tooltipText={bindAs(time, t => t.date)}
    cssClasses={(props.cssClasses ?? []).concat(['flat', 'circular'])}
    onClicked={() => execAsync(['swaync-client', '-t']).catch()}
  >
    <label label={bindAs(time, t => t.clock)} />
  </PanelButton>
)

// Battery
const battery = AstalBattery.get_default()
export const BatteryIndicator = () => (
  <IconIndicator
    isMaterial={false}
    tooltip={bind(battery, 'percentage').as(String)}
    icon={bind(battery, 'battery_icon_name')}
  />
)

// PowerProfiles
const profiles = AstalPowerProfiles.get_default()

function cycleProfiles() {
  const p = AstalPowerProfiles.get_default()
  const profiles = p.get_profiles()
  const currentProfile = p.get_active_profile()
  const currentIdx = profiles.findIndex(p => p.profile == currentProfile)
  p.set_active_profile(profiles[(currentIdx + 1) % profiles.length].profile)
}
export const PowerProfilesIndicator = () => (
  <PanelButton
    tooltipText={bind(profiles, 'active_profile')}
    iconName={bind(profiles, 'iconName')}
    onClicked={cycleProfiles}
  />
)

// Muted
const isMuted = fromChain(
  fromConnectable(AstalWp.get_default(), 'default_speaker'),
  'mute',
)
export const MutedIndicator = () => (
  <image iconName="audio-volume-muted" visible={binding(isMuted)} />
)

// ETH
const wired = fromChain(
  fromConnectable(AstalNetwork.get_default(), 'wired'),
  'state',
)
const ethIcon = wired.pipe(
  map(s => {
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
  }),
)

const ethEnabled = wired.pipe(
  map(
    s =>
      ![
        AstalNetwork.DeviceState.DISCONNECTED,
        AstalNetwork.DeviceState.UNAVAILABLE,
      ].includes(s),
  ),
)

const ethSpeed = fromChain(
  fromConnectable(AstalNetwork.get_default(), 'wired'),
  'speed',
)
export const EthIndicator = () => (
  <IconIndicator
    isMaterial={false}
    icon={binding(ethIcon)}
    tooltip={bindString(ethSpeed)}
    visible={binding(ethEnabled)}
  />
)

// WIFI
const { wifi } = AstalNetwork.get_default()
export const WifiIndicator = () => (
  <IconIndicator
    isMaterial={false}
    tooltip={bind(wifi, 'ssid').as(String)}
    icon={bind(wifi, 'iconName')}
  />
)

// Swaync
type SwayncStatus = {
  count: number
  dnd: boolean
  visible: boolean
  inhibited: boolean
}

const isDndEnabled = fromJsonProcess<SwayncStatus>('swaync-client -s').pipe(
  map(s => s.dnd),
)
export const DndIndicator = () => (
  <MaterialIcon
    icon="do_not_disturb_on"
    style={{
      fill: false,
      size: 24,
    }}
    visible={binding(isDndEnabled)}
  />
)
