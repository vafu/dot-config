import { Accessor } from 'gnim'
import { Gtk } from 'ags/gtk4'
import { MaterialIcon } from 'widgets/materialicon'
import { LevelIndicator, RenderStyle } from 'widgets/circularstatus'
import { BehaviorSubject, combineLatest, map, Observable, of, tap } from 'rxjs'
import { binding, fromConnectable, subscribeTo } from 'rxbinding'
import { WidgetProps } from 'widgets'
import GObject from 'gnim/gobject'

type SubgroupProps = (Gtk.Box.ConstructorProps)
  & WidgetProps
  & { children: GObject.Object[] }
  & { revealWhen?: Observable<boolean> }

export const Subgroup = (props: SubgroupProps) => {
  const { css_classes, children, revealWhen, ...boxprops } = props

  const box = new Gtk.Box({
    ...boxprops
  })

  const main = children.pop() as Gtk.Widget

  const revealer = new Gtk.Revealer({
    child: box,
    reveal_child: false,
    transition_type: Gtk.RevealerTransitionType.SLIDE_LEFT
  })

  if (!!revealWhen) {
    const s = revealWhen.subscribe(reveal => revealer.set_reveal_child(reveal))
    revealer.connect("destroy", s.unsubscribe)
  }

  children.forEach(w => box.append(w as Gtk.Widget))

  return <box css_classes={css_classes}>
    <Gtk.EventControllerMotion
      onEnter={() => revealer.set_reveal_child(true)}
      onLeave={() => revealer.set_reveal_child(false)}
    />
    {revealer}
    {main}
  </box>
}

type PanelButtonProps = Gtk.Button.ConstructorProps & WidgetProps
export const PanelButton = (props: PanelButtonProps) => {
  const { cssClasses, child, ...buttonProps } = props
  const button = new Gtk.Button(buttonProps)
  button.add_css_class('panel-button')
  button.add_css_class('flat')
  button.add_css_class('circular')
  cssClasses?.forEach(c => button.add_css_class(c))
  button.set_child(child as Gtk.Widget)
  return button
}

type PanelButtonGroupProps = WidgetProps & {
  children: GObject.Object[]
  expandDirection?: 'left' | 'right'
  revealWhen?: Observable<boolean>
}

export const PanelButtonGroup = (props: PanelButtonGroupProps) => {
  const widgets = props.children
  widgets.forEach(b => {
    if (b instanceof Gtk.Button || b instanceof Gtk.MenuButton) {
      b.add_css_class('flat')
      b.add_css_class('circular')
      b.add_css_class('panel-widget')
    }
  })

  const hovered = new BehaviorSubject(false)
  const revealInputs = [
    hovered,
    ...widgets.map(w => {
      if (w instanceof Gtk.MenuButton) {
        return fromConnectable(w.popover, 'visible')
      }
      return of(false)
    }),
  ]
  if (props.revealWhen) revealInputs.push(props.revealWhen)

  const revealed = combineLatest(revealInputs).pipe(
    map(conditions => conditions.reduce((p, c) => p || c)),
    tap({
      next: r =>
        r ? main.add_css_class('opened') : main.remove_css_class('opened'),
    }),
  )

  const main = (
    <box cssClasses={['button-subgroup-main']}>{widgets.shift()}</box>
  ) as Gtk.Widget

  const group = (
    <revealer
      transition_type={Gtk.RevealerTransitionType.SLIDE_RIGHT}
      revealChild={binding(revealed, false)}
    >
      <box cssClasses={['button-subgroup']}>{widgets}</box>
    </revealer>
  ) as Gtk.Revealer
  const expandDirection = props.expandDirection ?? 'left'
  const cssClasses = (props.cssClasses ?? []).concat([
    `button-subgroup-expand-${expandDirection}`,
  ])

  return (
    <box cssClasses={cssClasses}>
      <Gtk.EventControllerMotion
        onEnter={() => hovered.next(true)}
        onLeave={() => hovered.next(false)}
      />
      {expandDirection === 'right' ? main : group}
      {expandDirection === 'right' ? group : main}
    </box>
  )
}

type MaybeObservable<T> = T | Observable<T>

type BadgeProps = {
  label: MaybeObservable<string>
  visible?: MaybeObservable<boolean>
  cssClasses?: MaybeObservable<string[]>
  halign?: Gtk.Align
  valign?: Gtk.Align
}

type BadgedProps = WidgetProps & {
  child: Gtk.Widget
  badges: BadgeProps[]
}

function isObservable<T>(value: MaybeObservable<T> | undefined): value is Observable<T> {
  return !!value && typeof (value as Observable<T>).subscribe === 'function'
}

function applyValue<T>(
  widget: Gtk.Widget,
  value: MaybeObservable<T> | undefined,
  fallback: T,
  apply: (value: T) => void,
) {
  if (isObservable(value)) {
    subscribeTo(widget, value, apply)
    return
  }
  apply(value ?? fallback)
}

function syncStyleClasses(widget: Gtk.Widget, previous: Set<string>, next: string[]) {
  for (const cssClass of previous) {
    widget.remove_css_class(cssClass)
  }

  previous.clear()
  for (const cssClass of next) {
    widget.add_css_class(cssClass)
    previous.add(cssClass)
  }
}

export const Badged = (props: BadgedProps) => {
  const overlay = new Gtk.Overlay({
    cssClasses: (props.cssClasses ?? []).concat(['barblock-badge-layer']),
  })
  overlay.set_child(props.child)

  for (const badgeProps of props.badges) {
    const badge = new Gtk.Label({
      halign: badgeProps.halign ?? Gtk.Align.END,
      valign: badgeProps.valign ?? Gtk.Align.START,
    })
    badge.add_css_class('barblock-badge')

    applyValue(badge, badgeProps.label, '', label => badge.set_label(label))
    applyValue(badge, badgeProps.visible, true, visible => badge.set_visible(visible))

    const dynamicClasses = new Set<string>()
    applyValue(badge, badgeProps.cssClasses, [], cssClasses => {
      syncStyleClasses(badge, dynamicClasses, cssClasses)
    })

    overlay.add_overlay(badge)
  }

  return overlay
}

const STYLE: Partial<RenderStyle> = {
  thickness: 3,
}

const ARC_STYLE: Partial<RenderStyle> = {
  style: 'arc',
  radius: 16,
  ...STYLE,
}

export type IconIndicatorProps = {
  isMaterial?: boolean
  icon: Accessor<string> | string
  tinted?: Accessor<boolean> | boolean
  tooltip?: Accessor<string> | string
  visible?: Accessor<boolean> | boolean
} & WidgetProps

export const IconIndicator = (props: IconIndicatorProps) => {
  return (props.isMaterial ?? true) ? (
    <MaterialIcon
      icon={props.icon}
      tinted={props.tinted ?? false}
      tooltipText={props.tooltip ?? props.icon}
      visible={props.visible ?? true}
      $={w => {
        props.cssClasses?.forEach(c => w.add_css_class(c))
        w.add_css_class('panel-widget')
      }}
    />
  ) : (
    <image
      iconName={props.icon}
      tooltipText={props.tooltip ?? props.icon}
      visible={props.visible ?? true}
      $={w => {
        props.cssClasses?.forEach(c => w.add_css_class(c))
        w.add_css_class('panel-widget')
      }}
    />
  )
}

const SlimIconIndicator = (props: IconIndicatorProps) => {
  const iconIndicator = IconIndicator(props) as Gtk.Widget
  iconIndicator.set_css_classes([])
  return iconIndicator
}

export const SingleIndicator = (
  props: {
    levelVisible?: Accessor<boolean> | boolean
    level: Accessor<number> | number
    stages: { level: number; class: string }[]
  } & IconIndicatorProps,
) => (
  <box cssClasses={(props.cssClasses ?? []).concat(['panel-widget'])}>
    {SlimIconIndicator(props)}
    <LevelIndicator
      stages={props.stages}
      style={{ style: 'line', ...STYLE }}
      level={props.level}
      visible={props.levelVisible ?? true}
    />
  </box>
)

export const DualIndicator = (
  props: {
    left: Accessor<number> | number
    levelsVisible: Accessor<boolean> | boolean
    right: Accessor<number> | number
    stages: { level: number; class: string }[]
  } & IconIndicatorProps,
) => (
  <box cssClasses={(props.cssClasses ?? []).concat(['panel-widget'])}>
    <LevelIndicator
      cssClasses={['battery']}
      style={ARC_STYLE}
      level={props.left}
      stages={props.stages}
      visible={props.levelsVisible}
    />
    {SlimIconIndicator(props)}
    <LevelIndicator
      cssClasses={['battery']}
      style={{ ...ARC_STYLE, curveDirection: 'start' }}
      level={props.right}
      stages={props.stages}
      visible={props.levelsVisible}
    />
  </box>
)
