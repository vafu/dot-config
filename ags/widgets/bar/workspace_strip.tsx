import Gio from 'gi://Gio?version=2.0'
import { Gtk } from 'ags/gtk4'
import Adw from 'gi://Adw?version=1'
import { bindAs, binding } from 'rxbinding'
import { BehaviorSubject, combineLatest, Subscription } from 'rxjs'
import { Workspace, Tab } from 'services/wm/types'
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
  const widgetWidth = options.widgetWidth ?? 200
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

  // Edge indicators for overflow content
  const leftIndicator = new Gtk.Box({
    css_classes: ['edge-indicator', 'left'],
    halign: Gtk.Align.START,
    valign: Gtk.Align.FILL,
  })
  leftIndicator.set_size_request(30, widgetHeight)
  leftIndicator.set_opacity(0)

  const rightIndicator = new Gtk.Box({
    css_classes: ['edge-indicator', 'right'],
    halign: Gtk.Align.END,
    valign: Gtk.Align.FILL,
  })
  rightIndicator.set_size_request(30, widgetHeight)
  rightIndicator.set_opacity(0)

  // Overlay to combine fixed + viewport indicator + edge indicators
  const overlay = new Gtk.Overlay()
  overlay.set_child(fixed)
  overlay.add_overlay(viewport)
  overlay.add_overlay(leftIndicator)
  overlay.add_overlay(rightIndicator)

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

  // === Simplified Column Widget Management ===
  
  /**
   * ColumnWidget - Encapsulates a tab widget with its state and subscriptions
   */
  class ColumnWidget {
    widget: Gtk.Overlay
    targetPosition: number = 0
    currentPosition: number = 0
    
    private iconSubject = new BehaviorSubject('')
    private tintSubject = new BehaviorSubject(false)
    private iconSub: Subscription | null = null
    private activeSub: Subscription | null = null
    private widthSub: Subscription | null = null
    private boundTab: Tab | null = null

    constructor() {
      this.widget = this.createWidget()
    }

    private createWidget(): Gtk.Overlay {
      const iconWidget = TintedIcon({
        tinted: binding(this.tintSubject, false),
        fileOrIcon: this.iconSubject,
      })
      iconWidget.set_vexpand(true)
      iconWidget.set_hexpand(false)
      iconWidget.add_css_class('column-item')
      
      return iconWidget
    }

    /**
     * Bind this widget to a tab's observables
     * Automatically handles rebinding if tab changes
     */
    bindToTab(tab: Tab) {
      if (this.boundTab === tab) return
      
      this.unbind()
      this.boundTab = tab

      this.iconSub = tab.icon.subscribe(icon => this.iconSubject.next(icon))
      this.activeSub = tab.isActive.subscribe(isActive => 
        this.tintSubject.next(!isActive)
      )
    }

    /**
     * Clean up all subscriptions
     */
    unbind() {
      this.iconSub?.unsubscribe()
      this.activeSub?.unsubscribe()
      this.widthSub?.unsubscribe()
      this.iconSub = null
      this.activeSub = null
      this.widthSub = null
      this.boundTab = null
    }

    destroy() {
      this.unbind()
    }
  }

  // Store column widgets by tab index
  const columns: ColumnWidget[] = []
  let animationFrameId: number | null = null

  /**
   * Smooth animation for column positions
   */
  const startAnimation = () => {
    if (animationFrameId !== null) return

    const animate = () => {
      let stillAnimating = false

      columns.forEach(column => {
        const diff = column.targetPosition - column.currentPosition

        if (Math.abs(diff) < 0.5) {
          column.currentPosition = column.targetPosition
          fixed.move(column.widget, Math.round(column.targetPosition), 0)
        } else {
          // Smooth easing: move 20% of remaining distance each frame
          column.currentPosition += diff * 0.2
          fixed.move(column.widget, Math.round(column.currentPosition), 0)
          stillAnimating = true
        }
      })

      if (!stillAnimating) {
        animationFrameId = null
        return false
      }
      return true
    }

    animationFrameId = fixed.add_tick_callback(animate)
  }

  /**
   * Synchronize column widgets with tabs array
   * - Add new widgets for new tabs
   * - Remove widgets for removed tabs
   * - Rebind widgets when tabs change at an index
   */
  const syncColumnWidgets = (tabs: Tab[]) => {
    // Add new columns if needed
    while (columns.length < tabs.length) {
      const column = new ColumnWidget()
      columns.push(column)
      fixed.put(column.widget, 0, 0)
    }

    // Remove excess columns
    while (columns.length > tabs.length) {
      const column = columns.pop()!
      column.destroy()
      fixed.remove(column.widget)
    }

    // Bind each column to its corresponding tab
    tabs.forEach((tab, idx) => {
      columns[idx].bindToTab(tab)
    })
  }

  /**
   * Update positions and visibility of all column widgets
   */
  const updateLayout = (tabs: Tab[], viewportOffset: number) => {
    const widgetStartOffset = viewportOffset - scale / 2
    const widgetEndOffset = viewportOffset + scale / 2

    let hasContentLeft = false
    let hasContentRight = false
    let cumulativePos = 0

    tabs.forEach((tab, idx) => {
      const column = columns[idx]
      const tabStartPos = cumulativePos

      // Get current width synchronously
      let currentWidth = 0
      tab.width.subscribe(w => (currentWidth = w)).unsubscribe()

      const tabEndPos = tabStartPos + currentWidth
      cumulativePos = tabEndPos

      // Check visibility
      const isVisible = tabEndPos > widgetStartOffset && tabStartPos < widgetEndOffset

      // Update edge indicators
      if (tabEndPos <= widgetStartOffset) hasContentLeft = true
      if (tabStartPos >= widgetEndOffset) hasContentRight = true

      // Calculate pixel position and size
      const tabPixelX = (tabStartPos - widgetStartOffset) * pixelsPerMonitorWidth
      const tabPixelWidth = currentWidth * pixelsPerMonitorWidth

      // Update target position
      column.targetPosition = tabPixelX

      // Set size and visibility
      column.widget.set_size_request(
        Math.max(16, Math.round(tabPixelWidth)),
        widgetHeight,
      )
      column.widget.set_visible(isVisible)

      // Initialize current position for new widgets
      if (column.currentPosition === 0 && column.targetPosition !== 0) {
        column.currentPosition = column.targetPosition
      }
    })

    // Update viewport overlay position
    viewport.set_margin_start(
      Math.round((viewportOffset - widgetStartOffset) * pixelsPerMonitorWidth),
    )

    // Update edge indicators
    leftIndicator.set_opacity(hasContentLeft ? 1 : 0)
    rightIndicator.set_opacity(hasContentRight ? 1 : 0)

    startAnimation()
  }

  // Main subscription: sync widgets and layout on any change
  combineLatest([ws.tabs, ws.viewportOffset]).subscribe(
    ([tabs, viewportOffset]) => {
      // Ignore empty tab arrays (happens during niri column swaps)
      if (tabs.length === 0) return

      syncColumnWidgets(tabs)
      updateLayout(tabs, viewportOffset)
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
    if (!p || p === '') {
      return // Ignore empty values
    }
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

