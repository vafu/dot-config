import App from 'ags/gtk4/app'
import Gio from 'gi://Gio?version=2.0'
import { Accessor } from 'gnim'
import { Astal, Gdk, Gtk } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'
import { binding } from 'rxbinding'
import GObject from 'ags/gobject'
import { ActionRow } from 'widgets/adw'
import { execAsync } from 'ags/process'
import { getRemarkedService, type Section, type Notebook } from 'services/remarked'
import todoUi from 'widgets/todo'

class TodoEntryObj extends GObject.Object {
  static {
    GObject.registerClass({
      Properties: {
        itemId: GObject.ParamSpec.string('itemId', '', '', GObject.ParamFlags.READWRITE, ''),
        text: GObject.ParamSpec.string('text', '', '', GObject.ParamFlags.READWRITE, ''),
        done: GObject.ParamSpec.boolean('done', '', '', GObject.ParamFlags.READWRITE, false),
      },
    }, this)
  }
  declare itemId: string
  declare text: string
  declare done: boolean
}

const remarked = getRemarkedService()

function escapeMarkup(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// --- Card types ---

interface BaseCard {
  container: Gtk.Box
  cursor: number
  type: 'todo' | 'sticky' | 'create'
}

interface TodoCard extends BaseCard {
  type: 'todo'
  section: Section
  items: Gio.ListStore
  selection: Gtk.SingleSelection
  hideCompleted: boolean
  completedCount: number
  titleEntry: Gtk.Entry
  entryWidget: Gtk.Entry
  toggleRow: Gtk.Box
  toggleLabel: Gtk.Label
  separator: Gtk.Separator
  checkMap: WeakMap<Adw.ActionRow, Gtk.CheckButton>
  handlerMap: WeakMap<Adw.ActionRow, number>
  syncing: boolean
}

interface StickyCard extends BaseCard {
  type: 'sticky'
  section: Section
  titleEntry: Gtk.Entry
  textView: Gtk.TextView
}

interface CreateCard extends BaseCard {
  type: 'create'
  todoRow: Gtk.Button
  notesRow: Gtk.Button
  editRow: Gtk.Button
  notebookId: string
}

type Card = TodoCard | StickyCard | CreateCard

// --- Notebook row: one horizontal carousel per notebook ---

interface NotebookRow {
  notebook: Notebook
  carousel: Adw.Carousel
  dots: Adw.CarouselIndicatorDots
  cards: Card[]
  activeCard: number
  container: Gtk.Box
}

// --- Main widget ---

export function TodoPopup(monitor: Accessor<Gdk.Monitor>) {
  let rows: NotebookRow[] = []
  let activeRow = 0
  let confirmingDelete = false

  const vCarousel = new Adw.Carousel({
    orientation: Gtk.Orientation.VERTICAL,
    allowMouseDrag: false,
    allowScrollWheel: false,
    allowLongSwipes: false,
    interactive: false,
    spacing: 16,
  })

  const vDots = new Adw.CarouselIndicatorDots({ carousel: vCarousel })

  function currentRow(): NotebookRow | null {
    return rows[activeRow] ?? null
  }

  function activeState(): Card | null {
    const row = currentRow()
    if (!row) return null
    return row.cards[row.activeCard] ?? null
  }

  // --- Cursor management ---

  function maxCursorPos(card: Card): number {
    switch (card.type) {
      case 'todo':
        return card.items.get_n_items()
      case 'sticky':
        return -1
      case 'create':
        return 2
    }
  }

  function setCursor(pos: number) {
    const card = activeState()
    if (!card) return
    card.cursor = pos

    if (card.type === 'todo') {
      card.toggleRow.cssClasses = ['todo-toggle-row']
      card.entryWidget.set_editable(false)

      const n = card.items.get_n_items()
      if (pos === -2) {
        card.selection.set_selected(Gtk.INVALID_LIST_POSITION)
        card.titleEntry.grab_focus()
      } else if (pos === -1) {
        card.selection.set_selected(Gtk.INVALID_LIST_POSITION)
        card.entryWidget.set_editable(true)
        card.entryWidget.grab_focus()
      } else if (pos === n) {
        card.selection.set_selected(Gtk.INVALID_LIST_POSITION)
        card.toggleRow.cssClasses = ['todo-toggle-row', 'todo-toggle-selected']
        card.container.grab_focus()
      } else {
        card.selection.set_selected(pos)
        card.container.grab_focus()
      }
    } else if (card.type === 'sticky') {
      if (pos === -2) {
        card.titleEntry.grab_focus()
      } else {
        card.textView.grab_focus()
      }
    } else if (card.type === 'create') {
      if (pos === 0) card.todoRow.grab_focus()
      else if (pos === 1) card.notesRow.grab_focus()
      else if (pos === 2) card.editRow.grab_focus()
    }
  }

  // --- Refresh ---

  function refreshTodoCard(card: TodoCard) {
    const todoItems = remarked.getItems(card.section.id)
    card.completedCount = todoItems.filter(t => t.done).length
    const pendingCount = todoItems.length - card.completedCount
    const showCompleted = !card.hideCompleted || pendingCount === 0

    card.items.remove_all()
    todoItems
      .filter(item => showCompleted || !item.done)
      .forEach(item => {
        const e = new TodoEntryObj()
        e.itemId = item.id
        e.text = item.text
        e.done = item.done
        card.items.append(e)
      })

    card.toggleLabel.set_label(card.hideCompleted
      ? `Show completed (${card.completedCount})`
      : 'Hide completed')
    card.separator.set_visible(card.completedCount > 0)
    card.toggleRow.set_visible(card.completedCount > 0)
  }

  function refreshStickyCard(card: StickyCard) {
    const notes = remarked.getNotes(card.section.id)
    card.textView.get_buffer().set_text(notes.map(n => n.text).join('\n\n'), -1)
  }

  // --- Card factories ---

  function createTodoCard(section: Section): TodoCard {
    const items = new Gio.ListStore({ item_type: TodoEntryObj.$gtype })
    const selection = new Gtk.SingleSelection({ model: items, autoselect: false, canUnselect: true })
    const factory = new Gtk.SignalListItemFactory()
    const checkMap = new WeakMap<Adw.ActionRow, Gtk.CheckButton>()
    const handlerMap = new WeakMap<Adw.ActionRow, number>()

    factory.connect('setup', (_self, listItem: Gtk.ListItem) => {
      const row = <ActionRow cssClasses={['']} /> as Adw.ActionRow
      const check = new Gtk.CheckButton()
      row.add_prefix(check)
      checkMap.set(row, check)
      listItem.set_child(row)
    })

    factory.connect('bind', (_self, listItem: Gtk.ListItem) => {
      const entry = listItem.get_item() as TodoEntryObj
      const row = listItem.get_child() as Adw.ActionRow
      const check = checkMap.get(row)!
      const prev = handlerMap.get(row)
      if (prev) check.disconnect(prev)
      card.syncing = true
      check.set_active(entry.done)
      card.syncing = false
      row.set_title(entry.done ? `<s>${escapeMarkup(entry.text)}</s>` : escapeMarkup(entry.text))
      const handler = check.connect('toggled', () => {
        if (card.syncing) return
        remarked.toggleItem(entry.itemId)
        refreshTodoCard(card)
      })
      handlerMap.set(row, handler)
    })

    const listView = new Gtk.ListView({ model: selection, factory, focusable: false, cssClasses: ['navigation-sidebar'] })
    const entryWidget = new Gtk.Entry({ placeholderText: 'New todo...', cssClasses: ['todo-entry'], hexpand: true })
    const toggleRow = new Gtk.Box({ cssClasses: ['todo-toggle-row'], orientation: Gtk.Orientation.HORIZONTAL })
    const toggleLabel = new Gtk.Label({ label: '', hexpand: true, xalign: 0 })
    toggleRow.append(toggleLabel)
    const separator = new Gtk.Separator({ cssClasses: ['todo-separator'] })
    const titleEntry = new Gtk.Entry({ cssClasses: ['todo-title-entry'], text: section.heading, hexpand: true })
    const saveTitle = () => {
      const h = titleEntry.get_text().trim()
      if (h && h !== section.heading) remarked.renameSection(section.id, h)
    }
    titleEntry.connect('activate', () => { saveTitle(); entryWidget.grab_focus() })
    const titleFc = new Gtk.EventControllerFocus()
    titleFc.connect('leave', saveTitle)
    titleEntry.add_controller(titleFc)

    const scrolled = new Gtk.ScrolledWindow({ hscrollbarPolicy: Gtk.PolicyType.NEVER, propagateNaturalHeight: true, maxContentHeight: 400 })
    scrolled.set_child(listView)

    const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, cssClasses: ['todo-card'], focusable: true })
    container.append(titleEntry)
    container.append(entryWidget)
    container.append(scrolled)
    container.append(separator)
    container.append(toggleRow)

    const card: TodoCard = {
      type: 'todo', section, items, selection, cursor: -2, hideCompleted: true, completedCount: 0,
      titleEntry, entryWidget, toggleRow, toggleLabel, separator, container, checkMap, handlerMap, syncing: false,
    }

    entryWidget.connect('activate', () => {
      if (card.cursor !== -1) return
      const text = entryWidget.get_text().trim()
      if (text === '') return
      remarked.addItem(card.section.id, text)
      entryWidget.set_text('')
      refreshTodoCard(card)
    })

    return card
  }

  function createStickyCard(section: Section): StickyCard {
    const titleEntry = new Gtk.Entry({ cssClasses: ['todo-title-entry'], text: section.heading, hexpand: true })
    const saveTitle = () => {
      const h = titleEntry.get_text().trim()
      if (h && h !== section.heading) remarked.renameSection(section.id, h)
    }
    titleEntry.connect('activate', () => { saveTitle(); textView.grab_focus() })
    const titleFc = new Gtk.EventControllerFocus()
    titleFc.connect('leave', saveTitle)
    titleEntry.add_controller(titleFc)

    const textView = new Gtk.TextView({
      wrapMode: Gtk.WrapMode.WORD_CHAR, hexpand: true, vexpand: true,
      cssClasses: ['sticky-text'], topMargin: 8, bottomMargin: 8, leftMargin: 8, rightMargin: 8,
    })

    const scrolled = new Gtk.ScrolledWindow({
      hscrollbarPolicy: Gtk.PolicyType.NEVER, vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
      propagateNaturalHeight: true, maxContentHeight: 400, vexpand: true,
    })
    scrolled.set_child(textView)

    const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, cssClasses: ['todo-card', 'sticky-card'], focusable: true })
    container.append(titleEntry)
    container.append(scrolled)

    const card: StickyCard = { type: 'sticky', section, cursor: -2, titleEntry, textView, container }

    const fc = new Gtk.EventControllerFocus()
    fc.connect('leave', () => saveStickyCard(card))
    textView.add_controller(fc)

    return card
  }

  function saveStickyCard(card: StickyCard) {
    const buffer = card.textView.get_buffer()
    const text = buffer.get_text(buffer.get_start_iter(), buffer.get_end_iter(), false)

    let safety = 100
    while (safety-- > 0) {
      const notes = remarked.getNotes(card.section.id)
      if (notes.length === 0) break
      remarked.deleteNote(notes[0].id)
    }

    text.split(/\n\n+/).filter(p => p.trim() !== '').forEach(para => {
      remarked.addNote(card.section.id, para.trim())
    })
  }

  function createCreateCard(notebookId: string): CreateCard {
    const todoRow = new Gtk.Button({ label: '+ Todo list', cssClasses: ['pill'] })
    const notesRow = new Gtk.Button({ label: '+ Notes', cssClasses: ['pill'] })
    const editRow = new Gtk.Button({ label: 'Edit in neovim', cssClasses: ['pill'] })

    const container = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL, cssClasses: ['create-card'],
      focusable: true, valign: Gtk.Align.CENTER, halign: Gtk.Align.CENTER, spacing: 8,
    })
    container.append(todoRow)
    container.append(notesRow)
    container.append(editRow)

    const card: CreateCard = { type: 'create', container, cursor: 0, todoRow, notesRow, editRow, notebookId }

    const createSection = (kind: 'todo' | 'sticky') => {
      remarked.addSection(notebookId, 'Untitled', kind)
      rebuildRow(currentRow()!)
      const row = currentRow()!
      row.activeCard = row.cards.length - 2
      row.carousel.scroll_to(row.cards[row.activeCard].container, false)
      setCursor(-2)
    }

    todoRow.connect('clicked', () => createSection('todo'))
    notesRow.connect('clicked', () => createSection('sticky'))
    editRow.connect('clicked', () => {
      execAsync(`runapp -- ghostty -e nvim '${notebookId.replace(/'/g, "'\\''")}'`)
      todoUi.hide()
    })

    return card
  }

  // --- Build notebook row ---

  function buildRow(notebook: Notebook): NotebookRow {
    const hCarousel = new Adw.Carousel({
      orientation: Gtk.Orientation.HORIZONTAL,
      allowMouseDrag: false, allowScrollWheel: false,
      allowLongSwipes: false, interactive: false, spacing: 16,
    })

    const hDots = new Adw.CarouselIndicatorDots({ carousel: hCarousel })

    const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, hexpand: true })
    container.append(hCarousel)
    container.append(hDots)

    const row: NotebookRow = { notebook, carousel: hCarousel, dots: hDots, cards: [], activeCard: 0, container }
    populateRow(row)
    return row
  }

  function populateRow(row: NotebookRow) {
    row.cards.forEach(c => row.carousel.remove(c.container))
    row.cards = []

    const sections = remarked.getSections(row.notebook.id)
    sections.forEach(section => {
      if (section.type === 'todo') {
        const card = createTodoCard(section)
        row.cards.push(card)
        row.carousel.append(card.container)
        refreshTodoCard(card)
      } else if (section.type === 'sticky') {
        const card = createStickyCard(section)
        row.cards.push(card)
        row.carousel.append(card.container)
        refreshStickyCard(card)
      }
      // Skip 'unknown' sections (empty, no content)
    })

    const createCrd = createCreateCard(row.notebook.id)
    row.cards.push(createCrd)
    row.carousel.append(createCrd.container)

    row.dots.set_visible(row.cards.length > 1)
    if (row.activeCard >= row.cards.length) row.activeCard = 0
    if (row.cards.length > 0) row.carousel.scroll_to(row.cards[row.activeCard].container, false)
  }

  function rebuildRow(row: NotebookRow) {
    populateRow(row)
  }

  // --- Build all ---

  function rebuildAll() {
    rows.forEach(r => vCarousel.remove(r.container))
    rows = []

    const notebooks = remarked.getNotebooks()
    notebooks.forEach(nb => {
      const row = buildRow(nb)
      rows.push(row)
      vCarousel.append(row.container)
    })

    vDots.set_visible(rows.length > 1)
    if (activeRow >= rows.length) activeRow = 0
    if (rows.length > 0) vCarousel.scroll_to(rows[activeRow].container, false)
  }

  // --- Navigation ---

  function switchCard(dir: number) {
    const row = currentRow()
    if (!row) return
    const next = row.activeCard + dir
    if (next < 0 || next >= row.cards.length) return
    const prev = activeState()
    if (prev?.type === 'sticky') saveStickyCard(prev)
    row.activeCard = next
    row.carousel.scroll_to(row.cards[next].container, true)
    setCursor(-1)
  }

  function switchRow(dir: number) {
    const next = activeRow + dir
    if (next < 0 || next >= rows.length) return
    const prev = activeState()
    if (prev?.type === 'sticky') saveStickyCard(prev)
    activeRow = next
    vCarousel.scroll_to(rows[next].container, true)
    setCursor(-1)
  }

  // --- Layout ---

  const outerBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL, cssClasses: ['todo-outer'],
    focusable: true, hexpand: true, valign: Gtk.Align.CENTER,
  })
  outerBox.append(vCarousel)
  outerBox.append(vDots)

  // --- Key handling ---

  const keyController = new Gtk.EventControllerKey()
  keyController.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
  keyController.connect('key-pressed', (_self, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      rows.forEach(r => r.cards.forEach(c => { if (c.type === 'sticky') saveStickyCard(c) }))
      todoUi.hide()
      return true
    }

    const card = activeState()
    const ctrl = _self.get_current_event()?.get_modifier_state()! & Gdk.ModifierType.CONTROL_MASK

    if (ctrl && keyval === Gdk.KEY_h) { switchCard(-1); return true }
    if (ctrl && keyval === Gdk.KEY_l) { switchCard(1); return true }
    if (ctrl && keyval === Gdk.KEY_k) { switchRow(-1); return true }
    if (ctrl && keyval === Gdk.KEY_j) { switchRow(1); return true }

    if (ctrl && keyval === Gdk.KEY_BackSpace && card && card.type !== 'create') {
      if (confirmingDelete) {
        const sectionId = (card as TodoCard | StickyCard).section.id
        remarked.deleteSection(sectionId)
        confirmingDelete = false
        const row = currentRow()!
        const prev = row.activeCard > 0 ? row.activeCard - 1 : 0
        rebuildRow(row)
        if (row.cards.length > 0) {
          row.activeCard = Math.min(prev, row.cards.length - 1)
          row.carousel.scroll_to(row.cards[row.activeCard].container, false)
          setCursor(-1)
        }
        return true
      } else {
        confirmingDelete = true
        card.container.cssClasses = [...card.container.cssClasses, 'todo-card-confirm-delete']
        return true
      }
    }

    if (confirmingDelete) {
      confirmingDelete = false
      if (card && card.type !== 'create') {
        card.container.cssClasses = card.container.cssClasses.filter(c => c !== 'todo-card-confirm-delete')
      }
    }

    if (card && card.type === 'sticky') return false

    if (!card) return false

    const max = maxCursorPos(card)

    if (keyval === Gdk.KEY_Down) {
      let next = card.cursor + 1
      if (card.type === 'todo' && next === card.items.get_n_items() && card.completedCount === 0) next++
      if (next <= max) setCursor(next)
      return true
    }

    if (keyval === Gdk.KEY_Up) {
      let prev = card.cursor - 1
      if (card.type === 'todo' && prev === card.items.get_n_items() && card.completedCount === 0) prev--
      if (prev >= -2) setCursor(prev)
      return true
    }

    if (card.type === 'create' && (keyval === Gdk.KEY_space || keyval === Gdk.KEY_Return)) {
      if (card.cursor === 0 || card.cursor === 1) {
        const kind = card.cursor === 0 ? 'todo' : 'sticky'
        remarked.addSection(card.notebookId, 'Untitled', kind as 'todo' | 'sticky')
        const row = currentRow()!
        rebuildRow(row)
        row.activeCard = row.cards.length - 2
        row.carousel.scroll_to(row.cards[row.activeCard].container, true)
        setCursor(-2)
        return true
      }
      if (card.cursor === 2) {
        execAsync(`runapp -- ghostty -e nvim '${card.notebookId.replace(/'/g, "'\\''")}'`)
        todoUi.hide()
        return true
      }
    }

    if (card.type === 'todo') {
      const n = card.items.get_n_items()

      if (card.cursor === n && (keyval === Gdk.KEY_space || keyval === Gdk.KEY_Return)) {
        card.hideCompleted = !card.hideCompleted
        refreshTodoCard(card)
        setCursor(-1)
        return true
      }

      if (card.cursor >= 0 && card.cursor < n) {
        if (keyval === Gdk.KEY_space || keyval === Gdk.KEY_Return) {
          const entry = card.items.get_item(card.cursor) as TodoEntryObj
          const savedPos = card.cursor
          remarked.toggleItem(entry.itemId)
          refreshTodoCard(card)
          if (card.hideCompleted && !entry.done) {
            const nn = card.items.get_n_items()
            setCursor(savedPos >= nn ? (nn > 0 ? nn - 1 : -1) : savedPos)
          } else {
            setCursor(savedPos)
          }
          return true
        }
        if (keyval === Gdk.KEY_BackSpace) {
          const entry = card.items.get_item(card.cursor) as TodoEntryObj
          remarked.deleteItem(entry.itemId)
          refreshTodoCard(card)
          if (card.cursor >= card.items.get_n_items()) {
            setCursor(card.items.get_n_items() > 0 ? card.items.get_n_items() - 1 : -1)
          } else {
            setCursor(card.cursor)
          }
          return true
        }
      }
    }

    return false
  })
  outerBox.add_controller(keyController)

  todoUi.active.subscribe(visible => {
    if (visible) {
      activeRow = 0
      rebuildAll()
      if (rows.length > 0 && rows[0].cards.length > 0) setCursor(-1)
    }
  })

  return (
    <window
      gdkmonitor={monitor}
      visible={binding(todoUi.active, false)}
      application={App}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.NORMAL}
      name={'todo'}
      keymode={Astal.Keymode.EXCLUSIVE}
      cssClasses={['todo-window']}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
    >
      {outerBox}
    </window>
  )
}
