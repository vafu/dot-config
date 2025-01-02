import { Binding } from 'astal'
import { Button, ButtonProps } from 'astal/gtk4/widget'

export type QuicktoggleProps = ButtonProps & {
  enabled?: boolean | Binding<boolean>
  iconName?: string | Binding<string>
  label?: string | Binding<string>
  onClicked?: () => void

  hasExtra?: boolean | Binding<boolean>
  onExtraClicked?: () => void
}

export const Quicktoggle = ({
  enabled = true,
  hasExtra = false,
  iconName = '',
  label = '',
  onClicked = () => {},
  onExtraClicked = () => {},
  setup = () => {},
  ...rest
}: QuicktoggleProps) => {
  const base_classes = ['icon-button', 'circular']
  let classes: Array<string> | Binding<Array<string>> = base_classes
  if (enabled) {
    classes = ['suggested-action', ...base_classes]
  }
  if (enabled instanceof Binding) {
    classes = enabled.as((e) => [e ? 'suggested-action' : '', ...base_classes])
  }
  return (
    <box cssClasses={['linked', 'quicktoggle']}>
      {Button(
        {
          onClicked: onClicked,
          css_classes: classes,
          hexpand: true,
          setup: setup,
          ...rest,
        },
        <box>
          <image icon_name={iconName} />
          <label label={label} />
        </box>
      )}
      {Button({
        icon_name: 'go-next',
        css_classes: classes,
        visible: hasExtra,
        onClicked: onExtraClicked,
        setup: (self) => {
          self.add_css_class('icon-button')
          setup(self)
        },
        ...rest,
      })}
    </box>
  )
}
