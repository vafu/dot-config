import { App, Astal, Gdk, Gtk } from 'astal/gtk4'
import { bindAs } from 'rxbinding'
import { getRsynapseService, RsynapseResult } from 'services/rsynapse'
import { SearchEntry } from 'widgets'
import { ActionRow, ListBox } from 'widgets/adw'

const rsynapse = getRsynapseService()

export function Rsynapse(monitor: Gdk.Monitor) {
  const listBox = (
    <ListBox
      selectionMode={Gtk.SelectionMode.SINGLE}
      setup={(self) => {
        self.connect('row-activated', (_, row) =>
          console.log('row activated', row)
        )
      }}
    >
      {bindAs(rsynapse.results, (r) => r.map(entry))}
    </ListBox>
  )
  return (
    <window
      gdkmonitor={monitor}
      visible={true}
      application={App}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      name={'rsynapse'}
      // TODO: should be Exclusive
      keymode={Astal.Keymode.ON_DEMAND}
      cssClasses={['rsynapse']}
      valign={Gtk.Align.CENTER}
      vexpand={true}
    >
      <box orientation={Gtk.Orientation.VERTICAL}>
        <SearchEntry
          onKeyPressed={(_, key) => {
            if (key == Gdk.KEY_Down) {
              listBox.grab_focus()
              const firstRow = listBox.get_first_child()
              if (firstRow) {
                listBox.select_row(firstRow)
              }
            }
          }}
          setup={(self) => {
            self.connect('search-changed', (e) => rsynapse.search(e.get_text()))
          }}
        />
        <Gtk.ScrolledWindow
          vscrollbarPolicy={Gtk.PolicyType.NEVER}
          minContentHeight={10}
        >
          {listBox}
        </Gtk.ScrolledWindow>
      </box>
    </window>
  )
}

function entry(item: RsynapseResult) {
  return (
    <ActionRow
      activatable={true}
      title={item.title}
      subtitle={item.description}
      icon_name={item.icon}
      setup={(self) => ((self as any)._rsynapseItem = item)}
    />
  )
}
