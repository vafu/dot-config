import { exec } from 'astal'
import { Gdk, Gtk } from 'astal/gtk4'
import { binding } from 'rxbinding'
import { getRsynapseService, RsynapseResult } from 'services/rsynapse'
import { SearchEntry } from 'widgets'
import rsynapseUi, { selection } from 'widgets/rsynapse'

const rsynapse = getRsynapseService()

export const RsynapseSearch = () => (
  <revealer 
    revealChild={binding(rsynapseUi.active)}
    transitionType={Gtk.RevealerTransitionType.CROSSFADE}
    halign={Gtk.Align.CENTER}
    type='overlay'
  >
    <SearchEntry
      css_classes={['bar-widget', 'rsynapse-search']}
      setup={(self) => {
        const focus = new Gtk.EventControllerFocus()
        focus.connect('leave', () => rsynapseUi.hide())
        self.add_controller(focus)

        const shortcuts = new Gtk.ShortcutController()
        shortcuts.add_shortcut(
          Gtk.Shortcut.new(
            Gtk.KeyvalTrigger.new(Gdk.KEY_Down, 0),
            Gtk.SignalAction.new('next-match')
          )
        )
        shortcuts.add_shortcut(
          Gtk.Shortcut.new(
            Gtk.KeyvalTrigger.new(Gdk.KEY_Up, 0),
            Gtk.SignalAction.new('previous-match')
          )
        )
        self.add_controller(shortcuts)

        rsynapseUi.active.subscribe((visible) => {
          if (visible) self.grab_focus()
        })

        self.connect('changed', (e) => rsynapse.search(e.get_text()))
        self.connect('next-match', () => {
          const n_items = selection.get_n_items()
          if (n_items === 0) return
          const next = (selection.selected + 1) % n_items
          selection.set_selected(next)
        })

        self.connect('previous-match', () => {
          const n_items = selection.get_n_items()
          if (n_items === 0) return
          let prev = selection.selected - 1
          if (prev < 0) {
            prev = n_items - 1
          }
          selection.set_selected(prev)
        })
        self.connect('activate', () => {
          const app = selection.get_item(
            selection.get_selected()
          ) as RsynapseResult
          app.launch()
          // exec(`notify-send ${app.title}`)
          self.set_text('')
          rsynapseUi.hide()
        })
        self.connect('stop-search', (e) => {
          self.set_text('')
          rsynapseUi.hide()
        })
      }}
    />
  </revealer>
)
