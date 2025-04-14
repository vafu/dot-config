import AstalPowerProfiles from 'gi://AstalPowerProfiles?version=0.1'
import { Quicktoggle } from './quicktoggle'
import { bind } from '../../../../../../usr/share/astal/gjs'
import { fromConnectable, subscribeTo } from 'rxbinding'

const p = AstalPowerProfiles.get_default()
const profiles = p.get_profiles()

function cycleProfiles() {
  const currentProfile = p.get_active_profile()
  const currentIdx = profiles.findIndex((p) => p.profile == currentProfile)
  p.set_active_profile(profiles[(currentIdx + 1) % profiles.length].profile)
}

export function PowerProfileQuicktoggle() {
  return (
    <Quicktoggle
      enabled={false}
      iconName={bind(p, 'iconName')}
      label={bind(p, 'active_profile')}
      onClicked={() => cycleProfiles()}
      setup={(self) => {
        subscribeTo(self, fromConnectable(p, 'active_profile'), (profile) => {
          profiles.forEach((p) => self.remove_css_class(p.profile))
          self.add_css_class(profile)
        })
      }}
    />
  )
}
