import { GObject } from 'astal'
import { astalify, Gdk, Gtk } from 'astal/gtk4'
import cairo from 'gi://cairo?version=1.0'
import { min } from 'rxjs'

// --- Default values (used if CSS doesn't provide them) ---
const DEFAULT_LEVEL_COLOR_CSS = new Gdk.RGBA({
  red: 0.2,
  green: 0.5,
  blue: 0.9,
  alpha: 1.0,
})
const DEFAULT_TRACK_COLOR_CSS = new Gdk.RGBA({
  red: 0.8,
  green: 0.8,
  blue: 0.8,
  alpha: 0.5,
})
const DEFAULT_THICKNESS_RATIO_CSS: number = 0.1 // Ratio to radius
const DEFAULT_START_ANGLE_CSS: number = 135 // Degrees
const DEFAULT_TOTAL_SPAN_CSS: number = 270 // Degrees
const DEFAULT_GAP_ANGLE_CSS: number = 2 // Degrees
const DEFAULT_ICON_SIZE_RATIO_CSS: number = 0.4 // Ratio to widget diameter

// Helper to safely get numeric CSS property
function getNumericCssProp(
  context: Gtk.StyleContext,
  name: string,
  defaultValue: number
): number {
  // In GTK4, get_property returns GtkCssValue. We need to get number from it.
  // For simplicity, we'll assume the CSS provides a raw number for now.
  // Proper parsing would involve checking value.get_value_type() and handling lengths, percentages etc.
  // Let's try get_property and hope it resolves to a number or something convertible.
  // Note: GJS typings might say 'any'. Runtime check might be needed.
  // A safer approach might be needed for production (e.g., using Gtk.CssParser if necessary)
  try {
    // Direct lookup (might work for simple numbers defined in CSS)
    const value = context.get_property(name, Gtk.StateFlags.NORMAL)
    if (typeof value === 'number') {
      return value
    }
    // If it's a Gtk.CssValue (common case), try to extract number
    // This part is speculative without running and testing types precisely
    if (
      value &&
      typeof value === 'object' &&
      typeof value.get_number === 'function'
    ) {
      return value.get_number()
    }
    // Add more checks if needed (e.g., for Gdk.Value)
  } catch (e) {
    console.warn(`Could not parse CSS property ${name}: ${e}`)
  }
  return defaultValue // Fallback
}

export type Single = { level: number }
export type Dual = { left: number; right: number }

export type Levels = Single | Dual | {}

function isSingle(v: Levels): v is Single {
  return (<Single>v).level !== undefined
}

function isDual(v: Levels): v is Dual {
  return (<Dual>v).left !== undefined
}

function isEmpty(v: Levels): boolean {
  return !isSingle(v) && !isDual(v)
}

type InternalProps = Gtk.Overlay.ConstructorProps & {
  levels?: Levels
  minValue?: number
  maxValue?: number
}

class CircularLevelIndicator extends Gtk.Overlay {
  static {
    GObject.registerClass(
      {
        GTypeName: 'CircularLevelIndicator',
        Properties: {
          'icon-name': GObject.ParamSpec.string(
            'icon-name',
            'Icon Name',
            'Name of the icon to display',
            GObject.ParamFlags.READWRITE,
            null
          ),
          // We are NOT defining GObject properties for CSS-controlled values
        },
        // We don't need install_css_property if we read manually in vfunc_css_changed
      },
      this
    )
  }

  private _levels: Levels
  private _minValue: number
  private _maxValue: number
  private _drawingArea: Gtk.DrawingArea

  // Internal state variables holding values derived from CSS
  private _cssLevelColor: Gdk.RGBA = DEFAULT_LEVEL_COLOR_CSS
  private _cssTrackColor: Gdk.RGBA = DEFAULT_TRACK_COLOR_CSS
  private _cssArcThicknessRatio: number = DEFAULT_THICKNESS_RATIO_CSS
  private _cssArcStartAngleRad: number =
    DEFAULT_START_ANGLE_CSS * (Math.PI / 180)
  private _cssArcTotalSpanRad: number = DEFAULT_TOTAL_SPAN_CSS * (Math.PI / 180)
  private _cssArcGapRad: number = DEFAULT_GAP_ANGLE_CSS * (Math.PI / 180)
  private _cssIconSizeRatio: number = DEFAULT_ICON_SIZE_RATIO_CSS

  // Simplified constructor - styling comes from CSS
  constructor(props: Partial<InternalProps>) {
    super(props)

    this.set_size_request(32, 32)
    this._levels = props.levels ?? {}
    this._minValue = props.minValue ?? 0
    this._maxValue = props.maxValue ?? 100

    this._readCssProperties()
    this._drawingArea = new Gtk.DrawingArea()
    this._drawingArea.set_draw_func(this._drawLevels.bind(this))
    this.set_child(this._drawingArea)
  }

  vfunc_css_changed(change: Gtk.CssStyleChange): void {
    super.vfunc_css_changed(change)
    this._readCssProperties()
    this._drawingArea.queue_draw()
  }

  vfunc_measure(
    orientation: Gtk.Orientation,
    for_size: number
  ): [number, number, number, number] {
    return super.vfunc_measure(orientation, for_size)
  }

  set levels(value: number[]) {
    this._levels = value
    this._drawingArea.queue_draw()
  }

  get levels() {
    return this._levels
  }

  private _readCssProperties(): void {
    const context = this.get_style_context()

    // Read colors
    this._cssLevelColor = context.get_color() ?? DEFAULT_LEVEL_COLOR_CSS // Use foreground color by default
    // For custom color properties:
    const levelColorVal = context.get_property(
      '--indicator-level-color',
      Gtk.StateFlags.NORMAL
    )
    if (levelColorVal instanceof Gdk.RGBA) this._cssLevelColor = levelColorVal
    else if (levelColorVal)
      console.warn('CSS property --indicator-level-color is not a color')

    const trackColorVal = context.get_property(
      '--indicator-track-color',
      Gtk.StateFlags.NORMAL
    )
    if (trackColorVal instanceof Gdk.RGBA) this._cssTrackColor = trackColorVal
    else if (trackColorVal)
      console.warn('CSS property --indicator-track-color is not a color')
    else this._cssTrackColor = DEFAULT_TRACK_COLOR_CSS // Fallback if not set

    // Read numeric properties
    this._cssArcThicknessRatio = getNumericCssProp(
      context,
      '--indicator-thickness-ratio',
      DEFAULT_THICKNESS_RATIO_CSS
    )
    const startAngleDeg = getNumericCssProp(
      context,
      '--indicator-start-angle',
      DEFAULT_START_ANGLE_CSS
    )
    const totalSpanDeg = getNumericCssProp(
      context,
      '--indicator-total-span',
      DEFAULT_TOTAL_SPAN_CSS
    )
    const gapAngleDeg = getNumericCssProp(
      context,
      '--indicator-gap-angle',
      DEFAULT_GAP_ANGLE_CSS
    )
    this._cssIconSizeRatio = getNumericCssProp(
      context,
      '--indicator-icon-size-ratio',
      DEFAULT_ICON_SIZE_RATIO_CSS
    )

    // Convert angles to radians
    this._cssArcStartAngleRad = startAngleDeg * (Math.PI / 180)
    this._cssArcTotalSpanRad = totalSpanDeg * (Math.PI / 180)
    this._cssArcGapRad = gapAngleDeg * (Math.PI / 180)

    // Clamp ratios
    this._cssArcThicknessRatio = Math.max(
      0.01,
      Math.min(1.0, this._cssArcThicknessRatio)
    )
    this._cssIconSizeRatio = Math.max(
      0.0,
      Math.min(1.0, this._cssIconSizeRatio)
    )
  }

  // --- Public API ---
  public setLevels(levels: number[]): void {
    this._levels = levels.map((level) => Math.max(0.0, Math.min(100, level)))
    this.queue_draw()
  }

  // --- Drawing Logic (Uses _css* variables) ---
  private _drawLevels(
    _: Gtk.DrawingArea,
    cr: cairo.Context,
    width: number,
    height: number
  ): void {
    const levels = this.levels
    if (isEmpty(levels)) return

    const centerX = width / 2
    const centerY = height / 2
    const outerRadius = Math.min(height, height) / 2 // Use full space now, padding can be CSS margin
    const arcThickness = outerRadius * this._cssArcThicknessRatio // Use CSS value
    const arcRadius = outerRadius - arcThickness / 2

    if (arcRadius <= 0) return

    function draw(
      value: number,
      from: number,
      span: number,
      negative: boolean
    ) {
      const drawArc = negative ? cr.arcNegative : cr.arc
      cr.save()
      Gdk.cairo_set_source_rgba(cr, this._cssTrackColor) // Use CSS value
      const to = from + span
      cr.arcNegative(centerX, centerY, arcRadius, from, to)
      cr.stroke()
      cr.restore()
      //
      if (levels.level >= this._minValue) {
        const levelEndAngle =
          from - span * (value / (this._minValue + this._maxValue))
        cr.save()
        Gdk.cairo_set_source_rgba(cr, this._cssLevelColor) // Use CSS value
        cr.arcNegative(centerX, centerY, arcRadius, from, levelEndAngle)
        cr.stroke()
        cr.restore()
      }
    }

    if (isSingle(levels)) {
      draw.bind(this)(levels.level, 0, this._cssArcTotalSpanRad, true)
    }
  }
}

export const CircularIndicator = astalify<
  CircularLevelIndicator,
  InternalProps
>(CircularLevelIndicator)
