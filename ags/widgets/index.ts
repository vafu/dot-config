import { Gtk } from 'ags/gtk4'
// Type utilities moved to ags/gtk4

export * from './adw'

// In AGS v3, widgets can be used directly in JSX without astalify
export const SearchEntry = Gtk.SearchEntry
export const ToggleButton = Gtk.ToggleButton

export type WidgetProps = {
  cssClasses?: string[]
}
