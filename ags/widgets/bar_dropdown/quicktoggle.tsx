import { Box, Button, ButtonProps, Icon, Label } from 'widgets/types'
import { Binding } from 'astal'
import Adw from 'gi://Adw?version=1'
import Gtk from 'gi://Gtk?version=4.0'

export type QuicktoggleProps = ButtonProps & {
  enabled?: boolean | Binding<boolean>
  iconName?: string | Binding<string>
  label?: string | Binding<string>
  onClicked?: () => void

  hasExtra?: boolean | Binding<boolean>
  onExtra?: () => void
}

export const Quicktoggle = ({
  enabled = true,
  hasExtra = false,
  iconName = '',
  label = '',
  onClicked = () => {},
  onExtra = () => {},
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
    <Box className="linked quicktoggle">
      {
        new Button(
          {
            onClicked: onClicked,
            css_classes: classes,
            hexpand: true,
            setup: setup,
            ...rest,
          },
          <Icon iconName={iconName} />,
          <Label label={label} />
        )
      }
      {
        new Button({
          iconName: 'go-next',
          css_classes: classes,
          visible: hasExtra,
          setup: (self) => {
            self.toggleClassName('icon-button')
            setup(self)
          },
          ...rest,
        })
      }
    </Box>
  )
}
