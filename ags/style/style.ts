import { AstalIO, exec, Gio, GLib, readFile, writeFile } from 'astal'
import { App } from 'astal/gtk4'
import './theming'

const sass_input = `${GLib.get_tmp_dir()}/tmp.scss`
const sass = `${GLib.get_tmp_dir()}/compiled.css`
const style = `${GLib.get_tmp_dir()}/main.css`

const regex = /^@define-color\s+(\w+)\s+(.+?);$/gm

AstalIO.monitor_file('./style', (f: string, event: Gio.FileMonitorEvent) => {
  if (event == Gio.FileMonitorEvent.CHANGED && !f.endsWith('ts')) {
    App.reset_css()
    compileCss()
    App.apply_css(style)
  }
})

export function compileCss() {
  const gtk_colors = readFile('./style/gtk_colors.css')
  const gtk_color_bindings = gtk_colors
    .split('\n')
    .filter((s) => s.startsWith('@define-color'))
    .map((s) => '$' + s.replace(regex, '$1: "@$1";'))
    .join('\n')

  exec('rm -rf /tmp/style/')
  exec('mkdir /tmp/style/')
  const scss_files = exec('bash scripts/findstyles.sh')
    .split(/\s+/)
    .map((f) => {
      exec(`cp ${f} /tmp/style/`)
      return `@import '${f}';`
    })
    .join('\n')

  writeFile(sass_input, gtk_color_bindings + '\n' + scss_files)
  exec(`sass ${sass_input} ${sass}`)
  const compiled = readFile(sass)
  writeFile(style, gtk_colors + '\n' + compiled)
}

compileCss()

export default style
