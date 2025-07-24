import { astalify, Gtk } from 'astal/gtk4'

export * from './adw'

export const SearchEntry = astalify<
  Gtk.SearchEntry,
  Gtk.SearchEntry.ConstructorProps
>(Gtk.SearchEntry)
