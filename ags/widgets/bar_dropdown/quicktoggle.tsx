import { Accessor } from 'gnim'
import { Widget } from 'ags/gtk4'
import type { ButtonProps } from 'ags/gtk4/widget'

export type QuicktoggleProps = ButtonProps & {
  enabled?: boolean | Accessor<boolean>
  iconName?: string | Accessor<string>
  label?: string | Accessor<string>
  onClicked?: () => void

  hasExtra?: boolean | Accessor<boolean>
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
  let classes: Array<string> | Accessor<Array<string>> = base_classes
  if (enabled) {
    classes = ['suggested-action', ...base_classes]
  }
  if (enabled instanceof Accessor) {
    classes = enabled.as((e) => [e ? 'suggested-action' : '', ...base_classes])
  }
  return (
    <box cssClasses={['linked', 'quicktoggle']}>
      {Widget.Button(
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
      {Widget.Button({
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
