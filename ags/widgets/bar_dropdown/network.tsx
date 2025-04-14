import AstalNetwork from 'gi://AstalNetwork?version=0.1'
import { binding, fromChain as chain, fromConnectable } from 'rxbinding'
import { Quicktoggle } from './quicktoggle'
import { bind } from 'astal'
import { map, Observable, of, switchMap } from 'rxjs'
import Gtk from 'gi://Gtk?version=4.0'
import Adw from 'gi://Adw?version=1'
import { ActionRow, ListBox } from 'widgets/adw'

const network = AstalNetwork.get_default()
const wifi = fromConnectable(network, 'wifi')
const wifiEnabled = chain(wifi, 'enabled')
const activeSsid = wifiEnabled.pipe(
  switchMap((enabled) =>
    enabled
      ? wifi.pipe(switchMap((w) => fromConnectable(w, 'ssid')))
      : of('WiFi off')
  )
)

function disconnect(ap: AstalNetwork.AccessPoint) {
  return activeSsid.pipe(
    map((active) =>
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
          cssClasses={['boxed-list']}
          selectionMode={Gtk.SelectionMode.NONE}
        >
          {binding(
            chain(wifi, 'access_points').pipe(
              map((n) =>
                n
                  .filter(
                    (a) => a != null && a.ssid != null && a.ssid.length > 0
                  )
                  .sort((a, b) => b.strength - a.strength)
                  .map((ap) => (
                    <ActionRow
                      title={ap.ssid}
                      iconName={bind(ap, 'icon_name')}
                      // subtitle={binding(subt(ap.ssid), '')}
                    ></ActionRow>
                  ))
              )
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
              <label label={binding(activeSsid)} cssClasses={['title']} />
            </box>
          }
        />
        <List />
      </box>
    ),
  })
}
