import { Box, Label } from './types'
import Pango from 'gi://Pango?version=1.0'
import Service from '../services'
import { binding } from 'rxbinding'

const active = Service('window').active

export const WindowTitle = () => (
  <Box className="window-title bar-widget">
    <Label className="cls" label={binding(active.cls)} />
    <Label ellipsize={Pango.EllipsizeMode.END} label={binding(active.title)} />
  </Box>
)
