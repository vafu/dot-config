import Gio from 'gi://Gio?version=2.0'
import { Gtk } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'
import { bindAs, binding } from 'rxbinding'
import { BehaviorSubject, combineLatest, Subscription } from 'rxjs'
import { Workspace } from 'services/wm/types'
import { Accessor, createRoot } from 'gnim'

/**
 * WorkspaceStrip - Visualizes Niri's infinite horizontal scrolling workspace
 * Shows a fixed range of workspace (e.g., 3 monitor widths) with columns positioned absolutely
 */
export const WorkspaceStrip = (
  ws: Workspace,
  options: {
    widgetWidth?: number
    widgetHeight?: number
    scale?: number // How many monitor widths to show in the widget
  } = {},
) => {
  const widgetWidth = options.widgetWidth ?? 300
  const widgetHeight = options.widgetHeight ?? 24
  const scale = options.scale ?? 3 // Show 3 monitor widths worth of space in the widget

  const pixelsPerMonitorWidth = widgetWidth / scale // e.g., 100px per monitor width
  const viewportWidthInWidget = pixelsPerMonitorWidth // Viewport is 1 monitor width

  // Main container - Gtk.Fixed for absolute positioning
  const fixed = new Gtk.Fixed({
    css_classes: ['workspace-strip-fixed'],
  })
  fixed.set_size_request(widgetWidth, widgetHeight)

  // Viewport overlay (shows one monitor width)
  const viewport = new Gtk.Box({
    css_classes: ['viewport-overlay'],
    halign: Gtk.Align.START,
    valign: Gtk.Align.CENTER,
  })
  viewport.set_size_request(viewportWidthInWidget, widgetHeight)

  // Overlay to combine fixed + viewport indicator
  const overlay = new Gtk.Overlay()
  overlay.set_child(fixed)
  overlay.add_overlay(viewport)

  // Wrapper for workspace tint
  const outerOverlay = new Gtk.Overlay()
  outerOverlay.set_size_request(widgetWidth, widgetHeight)

  const tintRevealer = createRoot(() => (
    <revealer
      hexpand={false}
      vexpand={false}
      transitionType={Gtk.RevealerTransitionType.CROSSFADE}
      revealChild={bindAs(ws.active, a => !a, false)}
      $type="overlay"
    >
      <box hexpand={false} vexpand={false} css_classes={['tint']} />
    </revealer>
  )) as Gtk.Revealer
  tintRevealer.set_size_request(widgetWidth, widgetHeight)

  outerOverlay.set_child(overlay)
  outerOverlay.add_overlay(tintRevealer)

  // Track column widgets and subscriptions
  const columnWidgets: Map<number, Gtk.Overlay> = new Map()
  let layoutSub: Subscription | null = null

  // Subscribe to combined tabs + viewportOffset to calculate positions
  layoutSub = combineLatest([ws.tabs, ws.viewportOffset]).subscribe(
    ([tabs, viewportOffset]) => {
      console.log(
        `[WorkspaceStrip WS${ws.wsId}] Layout update: ${tabs.length} tabs, viewportOffset=${viewportOffset.toFixed(3)}`,
      )

      // Calculate widget display range in workspace coordinates
      const widgetStartOffset = viewportOffset - scale / 2
      const widgetEndOffset = viewportOffset + scale / 2

      // Process all tabs: calculate positions, determine visibility, create/update widgets
      const visibleTabs = new Set<number>()
      let cumulativePos = 0

      tabs.forEach(tab => {
        const tabStartPos = cumulativePos

        // Get current width synchronously
        let currentWidth = 0
        tab.width.subscribe(w => (currentWidth = w)).unsubscribe()

        const tabEndPos = tabStartPos + currentWidth
        cumulativePos = tabEndPos

        // Check if tab is visible
        const isVisible = tabEndPos > widgetStartOffset && tabStartPos < widgetEndOffset
        
        if (!isVisible) return

        visibleTabs.add(tab.tabId)

        // Create widget if needed
        if (!columnWidgets.has(tab.tabId)) {
          const column = createColumnWidget({
            tab,
            selectedTab: ws.selectedTab,
            widgetHeight,
          })
          columnWidgets.set(tab.tabId, column)
          fixed.put(column, 0, 0)
        }

        // Update position and size
        const tabPixelX = (tabStartPos - widgetStartOffset) * pixelsPerMonitorWidth
        const tabPixelWidth = currentWidth * pixelsPerMonitorWidth
        const column = columnWidgets.get(tab.tabId)!

        fixed.move(column, Math.round(tabPixelX), 0)
        column.set_size_request(Math.max(16, Math.round(tabPixelWidth)), widgetHeight)

        console.log(
          `  Tab ${tab.tabId}: wsPos=${tabStartPos.toFixed(3)}, pixelX=${tabPixelX.toFixed(1)}px, width=${tabPixelWidth.toFixed(1)}px`,
        )
      })

      // Remove widgets that are no longer visible
      columnWidgets.forEach((widget, tabId) => {
        if (!visibleTabs.has(tabId)) {
          fixed.remove(widget)
          columnWidgets.delete(tabId)
        }
      })

      // Position viewport overlay based on viewportOffset
      viewport.set_margin_start(
        Math.round((viewportOffset - widgetStartOffset) * pixelsPerMonitorWidth)
      )
    },
  )

  // Clamp to enforce maximum width
  const clamp = new Adw.Clamp({
    maximum_size: widgetWidth,
    tightening_threshold: widgetWidth,
  })
  clamp.set_child(outerOverlay)

  return clamp
}

const createColumnWidget = (options: {
  tab: import('services/wm/types').Tab
  selectedTab: import('rxjs').Observable<import('services/wm/types').Tab>
  widgetHeight: number
}) => {
  const { tab, selectedTab, widgetHeight } = options

  // Create tint subject that updates based on selection
  const tintSubject = new BehaviorSubject(false)
  selectedTab.subscribe(selected => {
    const isSelected = selected.tabId === tab.tabId
    tintSubject.next(!isSelected) // Tint when NOT selected
  })

  const iconWidget = TintedIcon({
    tinted: binding(tintSubject, false),
    fileOrIcon: tab.icon,
  })
  iconWidget.set_vexpand(true)
  iconWidget.set_hexpand(false)
  iconWidget.add_css_class('column-item')

  return iconWidget
}

const TintedIcon = (
  props: Partial<
    Gtk.Image.ConstructorProps & {
      tinted: Accessor<boolean> | boolean
      fileOrIcon: import('rxjs').Observable<string>
    }
  >,
) => {
  const { tinted, fileOrIcon, ...imageProps } = props
  const image = new Gtk.Image(imageProps)
  image.set_halign(Gtk.Align.CENTER)
  image.set_valign(Gtk.Align.CENTER)

  fileOrIcon!!.subscribe(p => {
    const file = Gio.file_new_for_path(p)
    if (file.query_exists(null)) {
      image.set_from_file(p)
    } else {
      image.set_from_icon_name(p)
    }
  })

  const overlay = new Gtk.Overlay()
  overlay.set_halign(Gtk.Align.CENTER)
  overlay.set_valign(Gtk.Align.CENTER)
  
  const revealer = createRoot(() => (
    <revealer
      hexpand={false}
      vexpand={false}
      transitionType={Gtk.RevealerTransitionType.CROSSFADE}
      revealChild={tinted}
    >
      <box hexpand={false} vexpand={false} css_classes={['tint']} />
    </revealer>
  )) as Gtk.Revealer

  overlay.add_overlay(revealer)
  overlay.set_child(image)

  return overlay
}

