import GLib from 'gi://GLib?version=2.0'
import Gio from 'gi://Gio?version=2.0'

const RemarkedIface = `
<node>
  <interface name="org.remarked.Service1">
    <method name="GetNotebooks">
      <arg type="a(sss)" name="notebooks" direction="out"/>
    </method>
    <method name="GetSections">
      <arg type="s" name="notebook_id" direction="in"/>
      <arg type="a(sss)" name="sections" direction="out"/>
    </method>
    <method name="GetItems">
      <arg type="s" name="section_id" direction="in"/>
      <arg type="a(ssb)" name="items" direction="out"/>
    </method>
    <method name="GetNotes">
      <arg type="s" name="section_id" direction="in"/>
      <arg type="a(ss)" name="notes" direction="out"/>
    </method>
    <method name="AddItem">
      <arg type="s" name="section_id" direction="in"/>
      <arg type="s" name="text" direction="in"/>
      <arg type="b" name="success" direction="out"/>
    </method>
    <method name="ToggleItem">
      <arg type="s" name="item_id" direction="in"/>
      <arg type="b" name="success" direction="out"/>
    </method>
    <method name="DeleteItem">
      <arg type="s" name="item_id" direction="in"/>
      <arg type="b" name="success" direction="out"/>
    </method>
    <method name="UpdateItem">
      <arg type="s" name="item_id" direction="in"/>
      <arg type="s" name="text" direction="in"/>
      <arg type="b" name="success" direction="out"/>
    </method>
    <method name="AddNote">
      <arg type="s" name="section_id" direction="in"/>
      <arg type="s" name="text" direction="in"/>
      <arg type="b" name="success" direction="out"/>
    </method>
    <method name="DeleteNote">
      <arg type="s" name="item_id" direction="in"/>
      <arg type="b" name="success" direction="out"/>
    </method>
    <method name="UpdateNote">
      <arg type="s" name="item_id" direction="in"/>
      <arg type="s" name="text" direction="in"/>
      <arg type="b" name="success" direction="out"/>
    </method>
    <method name="RenameSection">
      <arg type="s" name="section_id" direction="in"/>
      <arg type="s" name="new_heading" direction="in"/>
      <arg type="b" name="success" direction="out"/>
    </method>
    <method name="DeleteSection">
      <arg type="s" name="section_id" direction="in"/>
      <arg type="b" name="success" direction="out"/>
    </method>
    <method name="AddSection">
      <arg type="s" name="notebook_id" direction="in"/>
      <arg type="s" name="heading" direction="in"/>
      <arg type="s" name="kind" direction="in"/>
      <arg type="b" name="success" direction="out"/>
    </method>
    <method name="Undo">
      <arg type="s" name="notebook_id" direction="in"/>
      <arg type="b" name="success" direction="out"/>
    </method>
    <signal name="NotebookChanged">
      <arg type="s" name="notebook_id"/>
    </signal>
    <signal name="SectionChanged">
      <arg type="s" name="section_id"/>
    </signal>
  </interface>
</node>
`

const RemarkedProxy = Gio.DBusProxy.makeProxyWrapper(RemarkedIface)

export interface Notebook {
  id: string
  title: string
  path: string
}

export interface Section {
  id: string
  heading: string
  type: 'todo' | 'sticky' | 'unknown'
}

export interface TodoItem {
  id: string
  text: string
  done: boolean
}

export interface StickyNote {
  id: string
  text: string
}

function call(proxy: any, method: string, args: any): any {
  try {
    const variant = proxy.call_sync(
      method,
      args,
      Gio.DBusCallFlags.NONE,
      1000,
      null,
    )
    return variant?.deep_unpack()
  } catch (e) {
    console.error(`[remarked] ${method} failed:`, e)
    return null
  }
}

export interface RemarkedService {
  getNotebooks(): Notebook[]
  getSections(notebookId: string): Section[]
  getItems(sectionId: string): TodoItem[]
  getNotes(sectionId: string): StickyNote[]
  addItem(sectionId: string, text: string): boolean
  toggleItem(itemId: string): boolean
  deleteItem(itemId: string): boolean
  updateItem(itemId: string, text: string): boolean
  addNote(sectionId: string, text: string): boolean
  deleteNote(noteId: string): boolean
  updateNote(noteId: string, text: string): boolean
  renameSection(sectionId: string, newHeading: string): boolean
  deleteSection(sectionId: string): boolean
  addSection(notebookId: string, heading: string, kind: 'todo' | 'sticky'): boolean
  undo(notebookId: string): boolean
}

function initRemarked(): RemarkedService {
  const proxy = RemarkedProxy(
    Gio.DBus.session,
    'org.remarked.Service',
    '/org/remarked/Service',
  )

  return {
    getNotebooks() {
      const result = call(proxy, 'GetNotebooks', null)
      if (!result) return []
      return result[0].map(([id, title, path]: string[]) => ({ id, title, path }))
    },

    getSections(notebookId: string) {
      const result = call(proxy, 'GetSections', new GLib.Variant('(s)', [notebookId]))
      if (!result) return []
      return result[0].map(([id, heading, type]: string[]) => ({ id, heading, type }))
    },

    getItems(sectionId: string) {
      const result = call(proxy, 'GetItems', new GLib.Variant('(s)', [sectionId]))
      if (!result) return []
      return result[0].map(([id, text, done]: [string, string, boolean]) => ({ id, text, done }))
    },

    getNotes(sectionId: string) {
      const result = call(proxy, 'GetNotes', new GLib.Variant('(s)', [sectionId]))
      if (!result) return []
      return result[0].map(([id, text]: string[]) => ({ id, text }))
    },

    addItem(sectionId: string, text: string) {
      const result = call(proxy, 'AddItem', new GLib.Variant('(ss)', [sectionId, text]))
      return result?.[0] ?? false
    },

    toggleItem(itemId: string) {
      const result = call(proxy, 'ToggleItem', new GLib.Variant('(s)', [itemId]))
      return result?.[0] ?? false
    },

    deleteItem(itemId: string) {
      const result = call(proxy, 'DeleteItem', new GLib.Variant('(s)', [itemId]))
      return result?.[0] ?? false
    },

    updateItem(itemId: string, text: string) {
      const result = call(proxy, 'UpdateItem', new GLib.Variant('(ss)', [itemId, text]))
      return result?.[0] ?? false
    },

    addNote(sectionId: string, text: string) {
      const result = call(proxy, 'AddNote', new GLib.Variant('(ss)', [sectionId, text]))
      return result?.[0] ?? false
    },

    deleteNote(noteId: string) {
      const result = call(proxy, 'DeleteNote', new GLib.Variant('(s)', [noteId]))
      return result?.[0] ?? false
    },

    updateNote(noteId: string, text: string) {
      const result = call(proxy, 'UpdateNote', new GLib.Variant('(ss)', [noteId, text]))
      return result?.[0] ?? false
    },

    renameSection(sectionId: string, newHeading: string) {
      const result = call(proxy, 'RenameSection', new GLib.Variant('(ss)', [sectionId, newHeading]))
      return result?.[0] ?? false
    },

    deleteSection(sectionId: string) {
      const result = call(proxy, 'DeleteSection', new GLib.Variant('(s)', [sectionId]))
      return result?.[0] ?? false
    },

    addSection(notebookId: string, heading: string, kind: 'todo' | 'sticky') {
      const result = call(proxy, 'AddSection', new GLib.Variant('(sss)', [notebookId, heading, kind]))
      return result?.[0] ?? false
    },

    undo(notebookId: string) {
      const result = call(proxy, 'Undo', new GLib.Variant('(s)', [notebookId]))
      return result?.[0] ?? false
    },
  }
}

let service: RemarkedService

export function getRemarkedService(): RemarkedService {
  if (!service) {
    service = initRemarked()
  }
  return service
}
