import AstalNetwork from 'gi://AstalNetwork?version=0.1'
import { binding, obs } from 'rxbinding'
import { Quicktoggle } from './quicktoggle'
import { bind } from 'astal'
import { Observable } from 'rx'
import Gtk from 'gi://Gtk?version=4.0'
import Adw from 'gi://Adw?version=1'
import { ActionRow, ListBox } from 'widgets/adw'

const network = AstalNetwork.get_default()
const wifi = obs(network, 'wifi').shareReplay(1)
const wifiEnabled = wifi.flatMapLatest((w) => obs(w, 'enabled'))
const activeSsid = wifiEnabled.flatMapLatest((enabled) =>
  enabled
    ? wifi.flatMapLatest((w) => obs(w, 'ssid'))
    : Observable.just('WiFi off')
)

function subt(ssid: string) {
  return activeSsid.map((active) => (active == ssid ? 'Connected' : 'adsf'))
}

function disconnect(ap: AstalNetwork.AccessPoint) {
  return activeSsid.map((active) =>
    active == ap.ssid ? (
      <button
        css_classes={['icon-button', 'flat', 'circular']}
        iconName={'process-stop-symbolic'}
      />
    ) : (
      <button
        css_classes={['icon-button', 'flat', 'circular']}
        iconName={'object-select-symbolic'}
      />
    )
  )
}

export function NetworkQuicktoggle(
  openPage: (page: Adw.NavigationPage) => void
) {
  return (
    <Quicktoggle
      enabled={binding(wifiEnabled)}
      hasExtra={binding(wifiEnabled)}
      onClicked={() =>
        network.get_wifi().set_enabled(!network.get_wifi().get_enabled())
      }
      onExtraClicked={() => {
        network.wifi.scan()
        openPage(NetworkPage())
      }}
      iconName={bind(network.wifi, 'iconName')}
      label={binding(activeSsid)}
    />
  )
}

function List() {
  return new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    cssName: 'scrollable',
    vexpand: true,
    child: (
      <Adw.Clamp orientation={Gtk.Orientation.HORIZONTAL}>
        <ListBox
          className={'boxed-list'}
          selectionMode={Gtk.SelectionMode.NONE}
        >
          {binding(
            wifi
              .flatMapLatest((w) => obs(w, 'access_points'))
              .map((n) =>
                n
                  .filter(
                    (a) => a != null && a.ssid != null && a.ssid.length > 0
                  )
                  .sort((a, b) => b.strength - a.strength)
                  .map((ap) => (
                    <ActionRow
                      title={ap.ssid}
                      iconName={bind(ap, 'icon_name')}
                      subtitle={binding(subt(ap.ssid), '')}
                    >
                      <box>{binding(disconnect(ap))}</box>
                    </ActionRow>
                  ))
              )
          )}
        </ListBox>
      </Adw.Clamp>
    ),
  })
}

function NetworkPage() {
  return new Adw.NavigationPage({
    css_classes: ['list-page'],
    child: (
      <box orientation={Gtk.Orientation.VERTICAL}>
        <Adw.HeaderBar
          cssClasses={['flat']}
          titleWidget={
            <box>
              <image iconName={bind(network.wifi, 'iconName')} />
              <label label={binding(activeSsid)} className={'title'} />
            </box>
          }
        />
        <List />
      </box>
    ),
  })
}
