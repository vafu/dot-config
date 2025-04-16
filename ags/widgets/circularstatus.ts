import { GObject, timeout } from 'astal'
import { astalify, Gdk, Gtk } from 'astal/gtk4'
import cairo from 'gi://cairo?version=1.0'

type Orientation = 'horizontal' | 'vertical'
type Direction = 'standard' | 'inverted'
type CurveDirection = 'start' | 'end' // Arc only: 'start' = top/left, 'end' = bottom/right

interface BaseStyle {
  orientation: Orientation
  direction: Direction
  thickness: number // in pixels
  trackColor: Gdk.RGBA
  levelColor: Gdk.RGBA
  radius: number // Arc radius in pixels
}

type LineStyle = BaseStyle & {
  style: 'line'
}

type ArcStyle = BaseStyle & {
  style: 'arc'
  curveDirection: CurveDirection
}

export type RenderStyle = LineStyle | ArcStyle

export type LevelIndicatorProps = Gtk.Overlay.ConstructorProps & {
  level: number
  min: number
  stages: { level: number; class: string }[]
  max: number
  style: Partial<RenderStyle>
}

const DEFAULT_CLASS = 'default'
const TRACK_CLASS = 'track'
const LEVEL_CLASS = 'level'
const ARC_CLASS = 'arc'
const LINE_CLASS = 'line'

export class LevelIndicatorWidget extends Gtk.Overlay {
  static {
    GObject.registerClass(
      {
        GTypeName: 'LevelIndicator',
        CssName: 'levelindicator',
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

  private _stages: { level: number; class: string }[] = []
  set stages(stages: { level: number; class: string }[]) {
    this._stages = stages
    this._levelView.queue_draw()
  }

  private _trackView = new Gtk.DrawingArea()
  private _levelView = new Gtk.DrawingArea()
  // - Constructor -
  constructor(props: Partial<LevelIndicatorProps> = {}) {
    super(props)

    // Set initial values from props or defaults using the setters
    this.level = props.level ?? 0
    this.min = props.min ?? 0
    this.max = props.max ?? 100

    this._trackView.add_css_class('track')
    this._levelView.add_css_class('level')

    this._style = {
      style: 'arc',
      orientation: 'vertical',
      direction: 'standard',
      thickness: 3,
      radius: 8,
      trackColor: this._trackView.get_color(),
      levelColor: this._levelView.get_color(),
      curveDirection: 'end',
    }
    this.add_css_class(this._style.style)
    this.add_overlay(this._trackView)
    this.add_overlay(this._levelView)

    // Read initial style and set draw function
    this._trackView.set_draw_func(this._drawTrack)
    this._levelView.set_draw_func(this._draw)
  }

  set level(value: number) {
    const clampedValue = value // Maybe clamp here later if needed: Math.max(this._minValue, Math.min(value, this._maxValue));
    if (this._level !== clampedValue) {
      this._level = clampedValue
      this._levelView.queue_draw()
    }
  }

  set min(value: number) {
    if (this._minValue !== value) {
      this._minValue = value
      this._levelView.queue_draw() // Level percentage changes
      this._trackView.queue_draw() // Level percentage changes
    }
  }

  set max(value: number) {
    if (this._maxValue !== value) {
      this._maxValue = value
      this._trackView.queue_draw() // Level percentage changes
      this._levelView.queue_draw() // Level percentage changes
    }
  }

  set style(style: Partial<RenderStyle>) {
    this.remove_css_class(this._style.style)
    this._style = {
      ...this._style,
      ...style,
    }
    this.add_css_class(this._style.style)
  }

  private _drawTrack = (
    w: Gtk.DrawingArea,
    cr: cairo.Context,
    width: number,
    height: number
  ): void => {
    if (width <= 0 || height <= 0) return // Don't draw if no space

    const style = this._style

    switch (style.style) {
      case 'arc':
        this._drawArc(1, style, w.get_color(), cr, width, height)
        break
      case 'line':
      default: // Fallback to line
        this._drawLine(1, style, w.get_color(), cr, width, height)
        break
    }
  }

  prev_class: string = null
  // - Drawing -
  private _draw = (
    w: Gtk.DrawingArea,
    cr: cairo.Context,
    width: number,
    height: number
  ): void => {
    if (width <= 0 || height <= 0) return // Don't draw if no space
    if (this.prev_class != null) w.remove_css_class(this.prev_class)
    const range = this._maxValue - this._minValue
    const clampedLevel = Math.max(
      this._minValue,
      Math.min(this._level, this._maxValue)
    )
    const value = clampedLevel - this._minValue
    const fraction =
      range > 0 ? value / range : clampedLevel >= this._maxValue ? 1 : 0
    let cls = 'default'
    for (const s of this._stages) {
      if (value >= s.level) {
        cls = s.class
      }
    }
    this.prev_class = cls
    w.add_css_class(cls)

    switch (this._style.style) {
      case 'arc':
        this._drawArc(fraction, this._style, w.get_color(), cr, width, height)
        break
      case 'line':
      default: // Fallback to line
        this._drawLine(fraction, this._style, w.get_color(), cr, width, height)
        break
    }
  }

  // - Line Drawing Implementation -
  private _drawLine(
    fraction: number,
    style: LineStyle,
    color: Gdk.RGBA,
    cr: cairo.Context,
    width: number,
    height: number
  ): void {
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

    if (fraction > 0 && levelLength > 0) {
      cr.save()
      Gdk.cairo_set_source_rgba(cr, color)
      cr.moveTo(lx1, ly1)
      cr.lineTo(lx2, ly2)
      cr.stroke()
      cr.restore()
    }
  }
  private _drawArc(
    fraction: number,
    style: ArcStyle,
    color: Gdk.RGBA,
    cr: cairo.Context,
    width: number,
    height: number
  ): void {
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
    if (style.curveDirection === 'end') {
      startAngle += Math.PI
    }

    trackStartRad = startAngle - halfArcSpan
    trackEndRad = startAngle + halfArcSpan

    const drawArc =
      sweepDirection > 0 ? cr.arc.bind(cr) : cr.arcNegative.bind(cr)

    // cr.save()
    // Gdk.cairo_set_source_rgba(cr, style.trackColor)
    // // drawArc(arcCenterX, arcCenterY, safeRadius, trackStartRad, trackEndRad)
    //
    // cr.stroke()
    // cr.restore()

    if (fraction > 0) {
      cr.save()
      Gdk.cairo_set_source_rgba(cr, color)

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
