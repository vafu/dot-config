import { Accessor } from 'gnim'
import { Gtk } from 'ags/gtk4'
import { MaterialIcon } from 'widgets/materialicon'
import { LevelIndicator, RenderStyle } from 'widgets/circularstatus'
import { BehaviorSubject, combineLatest, map, of, tap } from 'rxjs'
import { binding, fromConnectable } from 'rxbinding'
import { WidgetProps } from 'widgets'
import GObject from 'gnim/gobject'

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

export const PanelButtonGroup = (props: { children: GObject.Object[] }) => {
  const widgets = props.children
  widgets.forEach(b => {
    if (b instanceof Gtk.Widget) {
      b.add_css_class('flat')
      b.add_css_class('circular')
      b.add_css_class('panel-widget')
    }
  })

  const hovered = new BehaviorSubject(false)
  const revealed = combineLatest(
    hovered,
    ...widgets.map(w => {
      if (w instanceof Gtk.MenuButton) {
        return fromConnectable(w.popover, 'visible')
      }
      return of(false)
    }),
  ).pipe(
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

  return (
    <box>
      <Gtk.EventControllerMotion
        onEnter={() => hovered.next(true)}
        onLeave={() => hovered.next(false)}
      />
      {group}
      {main}
    </box>
  )
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

