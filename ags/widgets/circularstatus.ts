import { GObject } from 'astal'
import { astalify, Gdk, Gtk } from 'astal/gtk4'
import { type } from 'astal/gtk4/astalify'
import cairo from 'gi://cairo?version=1.0'

const DEFAULT_LEVEL_COLOR = new Gdk.RGBA({
  red: 0.2,
  green: 0.5,
  blue: 0.9,
  alpha: 1.0,
})
const DEFAULT_TRACK_COLOR = new Gdk.RGBA({
  red: 0.8,
  green: 0.8,
  blue: 0.8,
  alpha: 0.5,
})
const DEFAULT_THICKNESS = 4 // pixels
const DEFAULT_RADIUS = 30 // pixels // Default radius for arc style

const DEFAULT_STYLE: RenderStyle = {
  style: 'line',
  levelColor: DEFAULT_LEVEL_COLOR,
  trackColor: DEFAULT_TRACK_COLOR,
  radius: 0,
  thickness: 4,
  orientation: 'vertical',
  direction: "standard"
}

type Orientation = 'horizontal' | 'vertical'
type Direction = 'standard' | 'inverted'
type CurveDirection = 'start' | 'end' // Arc only: 'start' = top/left, 'end' = bottom/right

interface BaseStyle {
  orientation: Orientation
  direction: Direction
}

interface CssStyle {
  thickness: number // in pixels
  trackColor: Gdk.RGBA
  levelColor: Gdk.RGBA
  radius: number // Arc radius in pixels
}

interface LineStyle extends BaseStyle {
  style: 'line'
}

interface ArcStyle extends BaseStyle {
  style: 'arc'
  curveDirection: CurveDirection
}

type Style = LineStyle | ArcStyle
type RenderStyle = Style & CssStyle


// - Props -
// Interface for constructor properties, merging with Gtk.DrawingArea constructor props
// GObject properties themselves are defined in the static block
export interface LevelIndicatorProps extends Gtk.DrawingArea.ConstructorProps {
  level?: number
  min?: number
  max?: number
  style: Partial<Style>
}

// - Helper Functions for CSS Parsing -

// Basic helper to get string properties, handling CssValue if needed
function getCssString(
  context: Gtk.StyleContext,
  name: string,
  defaultValue: string
): string {
  try {
    // context.get_property() is deprecated, lookup_property is preferred
    // but lookup_property returns Gtk.CssValue which needs parsing.
    // Let's try the simpler context.lookup_color first for colors,
    // and stick to basic parsing for others for now.
    // NOTE: A robust solution involves checking Gtk.CssValue type and extracting.
    const value = context.get_property(name, Gtk.StateFlags.NORMAL) // Using deprecated for simplicity here
    if (typeof value === 'string' && value) {
      return value
    }
    // Add basic CssValue check if necessary and possible in env
  } catch (e) {
    /* Ignore errors, use default */
  }
  return defaultValue
}

// Basic helper for pixel lengths
function getCssLength(
  context: Gtk.StyleContext,
  name: string,
  defaultValue: number
): number {
  try {
    const value = context.get_property(name, Gtk.StateFlags.NORMAL)
    if (typeof value === 'number') {
      return value // Assume raw number means pixels
    }
    if (typeof value === 'string' && value.endsWith('px')) {
      const num = parseFloat(value.slice(0, -2))
      if (!isNaN(num)) return num
    }
    // Add basic CssValue check if necessary
  } catch (e) {
    /* Ignore errors, use default */
  }
  return defaultValue
}

// Helper for colors
function getCssColor(
  context: Gtk.StyleContext,
  name: string,
  defaultValue: Gdk.RGBA
): Gdk.RGBA {
  const [success, color] = context.lookup_color(name)

  if (success && color) {
    return color
  }
  // Fallback 1: Try deprecated get_property if lookup failed
  try {
    const value = context.get_property(name, Gtk.StateFlags.NORMAL)
    if (value instanceof Gdk.RGBA) {
      return value
    }
  } catch (e) {
    /* Ignore */
  }
  // Fallback 2: Widget's foreground color
  // const [fgSuccess, fgColor] = context.lookup_color('color');
  // if (fgSuccess && fgColor) return fgColor;
  // Fallback 3: Hardcoded default
  return defaultValue
}


export class LevelIndicatorWidget extends Gtk.DrawingArea {
  static {
    GObject.registerClass(
      {
        GTypeName: 'LevelIndicator',
        CssName: 'levelindicator',
        Properties: {
          level: GObject.ParamSpec.double(
            'level',
            'Level',
            'Current level value',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
            -Infinity,
            Infinity,
            0 // min, max, default
          ),
          min: GObject.ParamSpec.double(
            'min',
            'Minimum',
            'Minimum possible level',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
            -Infinity,
            Infinity,
            0
          ),
          max: GObject.ParamSpec.double(
            'max',
            'Maximum',
            'Maximum possible level',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.EXPLICIT_NOTIFY,
            -Infinity,
            Infinity,
            100
          ),
        },
      },
      this
    )
  }

  // - Private State -
  private _level: number
  private _minValue: number
  private _maxValue: number
  // Style state, initialized with defaults then overwritten by CSS parser
  private _style: RenderStyle
  // - Constructor -
  constructor(props: Partial<LevelIndicatorProps> = {}) {

    // Filter out our custom props before passing to super
    const {
      level: level,
      min: min,
      max: max,
      style: style,
      ...restProps
    } = props
    super(restProps)

    // Set initial values from props or defaults using the setters
    this.level = level ?? 0
    this.min = min ?? 0
    this.max = max ?? 100

    this._style = {
      ...DEFAULT_STYLE,
      ...style,
    }
    // this._updateStyle()
    this.set_content_width(1)
    this.set_content_height(1)

    // Read initial style and set draw function
    this.set_draw_func(this._draw)
  }

  // - GObject Property Accessors -
  get level(): number {
    return this._level
  }
  set level(value: number) {
    const clampedValue = value // Maybe clamp here later if needed: Math.max(this._minValue, Math.min(value, this._maxValue));
    if (this._level !== clampedValue) {
      this._level = clampedValue
      this.notify('level')
      this.queue_draw()
    }
  }

  get min(): number {
    return this._minValue
  }
  set min(value: number) {
    if (this._minValue !== value) {
      this._minValue = value
      this.notify('min')
      this.queue_draw() // Level percentage changes
    }
  }

  get max(): number {
    return this._maxValue
  }
  set max(value: number) {
    if (this._maxValue !== value) {
      this._maxValue = value
      this.notify('max')
      this.queue_draw() // Level percentage changes
    }
  }

  // - Public Methods -
  setLevel(level: number): void {
    this.level = level // Use property setter
  }

  // - Style Handling -
  vfunc_css_changed(change: Gtk.CssStyleChange): void {
    super.vfunc_css_changed(change)
    console.log('LevelIndicator: CSS Changed, reading properties...')
    this, this._updateStyle()
    this.queue_draw() // Redraw needed after style change
  }

  private _updateStyle() {
    const style = this._style
    const context = this.get_style_context()
    const cssStyle: CssStyle = {
      thickness: getCssLength(context, 'border-width', DEFAULT_THICKNESS),
      radius: getCssLength(context, 'border-radius', DEFAULT_THICKNESS),
      trackColor: getCssColor(context, 'background-color', DEFAULT_TRACK_COLOR),
      levelColor: getCssColor(context, 'color', DEFAULT_LEVEL_COLOR),
    }
    this._style = {
      ...style,
      ...cssStyle
    }
  }

  // - Drawing -
  private _draw = (
    _: Gtk.DrawingArea,
    cr: cairo.Context,
    width: number,
    height: number
  ): void => {
    if (width <= 0 || height <= 0) return // Don't draw if no space

    switch (this._style.style) {
      case 'arc':
        this._drawArc(this._style, cr, width, height)
        break
      case 'line':
      default: // Fallback to line
        this._drawLine(this._style, cr, width, height)
        break
    }
  }

  // - Line Drawing Implementation -
  private _drawLine(
    style: LineStyle,
    cr: cairo.Context,
    width: number,
    height: number
  ): void {
    const range = this._maxValue - this._minValue
    // Clamp level to min/max before calculating fraction
    const clampedLevel = Math.max(
      this._minValue,
      Math.min(this._level, this._maxValue)
    )
    const value = clampedLevel - this._minValue
    const fraction =
      range > 0 ? value / range : clampedLevel >= this._maxValue ? 1 : 0

    // Ensure thickness doesn't exceed bounds
    const safeThickness = Math.max(1, style.thickness)
    const halfThickness = safeThickness / 2

    cr.setLineWidth(safeThickness)
    cr.setLineCap(cairo.LineCap.ROUND) // Or Cairo.LineCap.BUTT

    let x1: number, y1: number, x2: number, y2: number // Track start/end
    let lx1: number, ly1: number, lx2: number, ly2: number // Level start/end
    let levelLength: number

    if (style.orientation === 'horizontal') {
      // Ensure track fits within bounds considering thickness
      x1 = halfThickness
      x2 = width - halfThickness
      y1 = y2 = height / 2 // Center vertically

      // Prevent negative length if width is too small for thickness
      if (x1 >= x2) return

      lx1 = x1
      ly1 = y1
      const trackLength = x2 - x1
      levelLength = trackLength * fraction

      if (style.direction === 'standard') {
        // Left to Right
        lx2 = x1 + levelLength
        ly2 = y1
      } else {
        // Inverted - Right to Left
        lx1 = x2 - levelLength
        lx2 = x2
        ly2 = y1
      }
    } else {
      // Vertical
      y1 = halfThickness
      y2 = height - halfThickness
      x1 = x2 = width / 2 // Center horizontally

      // Prevent negative length
      if (y1 >= y2) return

      lx1 = x1
      ly1 = y1
      const trackLength = y2 - y1
      levelLength = trackLength * fraction

      if (style.direction === 'inverted') {
        // Top to Bottom
        ly2 = y1 + levelLength
        lx2 = x1
      } else {
        // Inverted - Bottom to Top
        ly1 = y2 - levelLength
        ly2 = y2
        lx2 = x1
      }
    }

    // Draw Track
    cr.save()
    Gdk.cairo_set_source_rgba(cr, style.trackColor)
    cr.moveTo(x1, y1)
    cr.lineTo(x2, y2)
    cr.stroke()
    cr.restore()

    // Draw Level
    if (fraction > 0 && levelLength > 0) {
      // Check levelLength too
      cr.save()
      Gdk.cairo_set_source_rgba(cr, style.levelColor)
      cr.moveTo(lx1, ly1)
      cr.lineTo(lx2, ly2)
      cr.stroke()
      cr.restore()
    }
  }
  private _drawArc(
    style: ArcStyle,
    cr: cairo.Context,
    width: number,
    height: number
  ): void {
    const range = this._maxValue - this._minValue
    const clampedLevel = Math.max(
      this._minValue,
      Math.min(this._level, this._maxValue)
    )
    const value = clampedLevel - this._minValue
    const fraction =
      range > 0 ? value / range : clampedLevel >= this._maxValue ? 1 : 0

    const safeRadius = Math.max(1, style.radius)
    const safeThickness = Math.max(1, style.thickness)

    // Apply environment-specific camelCase methods
    cr.setLineWidth(safeThickness)
    cr.setLineCap(cairo.LineCap.ROUND) // Assuming standard enum casing

    let arcCenterX: number, arcCenterY: number
    let trackStartRad: number, trackEndRad: number
    let arcSpanRad: number // TOTAL angular span calculated dynamically
    const curveDirectionModifier = style.curveDirection == 'start' ? -1 : 1
    const directionModifier = style.direction == 'inverted' ? -1 : 1
    const sweepDirection = curveDirectionModifier * directionModifier

    let halfLength: number
    if (style.orientation === 'horizontal') {
      halfLength = width / 2 - safeThickness
    } else {
      halfLength = height / 2 - safeThickness
    }
    halfLength = Math.max(0, halfLength)
    const asinArg = Math.min(1.0, Math.max(-1.0, halfLength / safeRadius))

    // Full 180 if dimension >= radius
    if (safeRadius <= halfLength) {
      arcSpanRad = Math.PI
    } else {
      arcSpanRad = 2 * Math.asin(asinArg)
    }
    if (isNaN(arcSpanRad) || arcSpanRad <= 0) return // Cannot draw

    if (style.orientation === 'horizontal') {
      arcCenterX = width / 2
      arcCenterY = height / 2 + safeRadius * curveDirectionModifier
    } else {
      // Vertical
      arcCenterY = height / 2
      arcCenterX = width / 2 + safeRadius * curveDirectionModifier
    }

    const halfArcSpan = (arcSpanRad / 2) * sweepDirection
    let startAngle = 0
    if (style.orientation === 'horizontal') {
      startAngle += 0.5 * Math.PI
    }
    if (style.curveDirection === "end") {
      startAngle += Math.PI
    }

    trackStartRad = startAngle - halfArcSpan
    trackEndRad = startAngle + halfArcSpan

    const drawArc =
      sweepDirection > 0 ? cr.arc.bind(cr) : cr.arcNegative.bind(cr)

    cr.save()
    Gdk.cairo_set_source_rgba(cr, style.trackColor)
    drawArc(arcCenterX, arcCenterY, safeRadius, trackStartRad, trackEndRad)

    cr.stroke()
    cr.restore()

    if (fraction > 0) {
      cr.save()
      Gdk.cairo_set_source_rgba(cr, style.levelColor)

      // Calculate end angle based on fraction of the *calculated* arcSpanRad
      const levelSweepAngle = arcSpanRad * fraction * sweepDirection
      const levelEndAngle = trackStartRad + levelSweepAngle

      drawArc(arcCenterX, arcCenterY, safeRadius, trackStartRad, levelEndAngle)
      cr.stroke()
      cr.restore()
    }
  }
}
export const LevelIndicator = astalify<
  LevelIndicatorWidget,
  LevelIndicatorProps
>(LevelIndicatorWidget)
