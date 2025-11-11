import { Binding } from 'astal'
import { Button, ButtonProps, MenuButton } from 'astal/gtk4/widget'
import { MaterialIcon } from 'widgets/materialicon'
import { Gtk } from 'astal/gtk4'
import { LevelIndicator, RenderStyle } from 'widgets/circularstatus'
import { BehaviorSubject, combineLatest, map, of, tap } from 'rxjs'
import { binding, fromConnectable } from 'rxbinding'
import { WidgetProps } from 'widgets'

type PanelButtonProps = ButtonProps & WidgetProps
export const PanelButton = (props: PanelButtonProps, child: Gtk.Widget) =>
  Button({
    setup: self => {
      self.add_css_class('panel-button')
      self.add_css_class('flat')
      self.add_css_class('circular')
    },
    child: child,
    ...props,
  })

export const PanelButtonGroup = (props: { children: Gtk.Widget[] }) => {
  const widgets = props.children
  widgets.forEach(b => {
    b.add_css_class('flat')
    b.add_css_class('circular')
    b.add_css_class('panel-widget')
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
  )

  const group = (
    <revealer
      transition_type={Gtk.RevealerTransitionType.SLIDE_RIGHT}
      revealChild={binding(revealed)}
    >
      <box cssClasses={['button-subgroup']}>{widgets}</box>
    </revealer>
  ) as Gtk.Revealer

  return (
    <box
      onHoverEnter={() => {
        hovered.next(true)
      }}
      onHoverLeave={() => {
        hovered.next(false)
      }}
    >
      {group}
      {main}
    </box>
  )
}

const STYLE: Partial<RenderStyle> = {
  thickness: 2,
}

const ARC_STYLE: Partial<RenderStyle> = {
  style: 'arc',
  radius: 16,
  ...STYLE,
}

export type IconIndicatorProps = {
  isMaterial?: boolean
  icon: Binding<string> | string
  tinted?: Binding<boolean> | boolean
  tooltip?: Binding<string> | string
  visible?: Binding<boolean> | boolean
} & WidgetProps

export const IconIndicator = (props: IconIndicatorProps) => {
  return (props.isMaterial ?? true) ? (
    <MaterialIcon
      icon={props.icon}
      tinted={props.tinted ?? false}
      tooltipText={props.tooltip ?? props.icon}
      visible={props.visible ?? true}
      cssClasses={(props.cssClasses ?? []).concat(['panel-widget'])}
    />
  ) : (
    <image
      iconName={props.icon}
      tooltipText={props.tooltip ?? props.icon}
      visible={props.visible ?? true}
      cssClasses={(props.cssClasses ?? []).concat(['panel-widget'])}
    />
  )
}

const SlimIconIndicator = (props: IconIndicatorProps) => {
  const iconIndicator = IconIndicator(props)
  iconIndicator.set_css_classes([])
  return iconIndicator
}

export const SingleIndicator = (
  props: {
    levelVisible?: Binding<boolean> | boolean
    level: Binding<number> | number
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
    left: Binding<number> | number
    levelsVisible: Binding<boolean> | boolean
    right: Binding<number> | number
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
