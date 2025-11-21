import { execAsync } from 'ags/process'
import { readFileAsync, writeFileAsync } from 'ags/file'
import Gio from 'gi://Gio?version=2.0'
import GLib from 'gi://GLib?version=2.0'
import App from 'ags/gtk4/app'
import AstalIO from 'gi://AstalIO?version=0.1'

const sass_input = `${GLib.get_tmp_dir()}/tmp.scss`
const sass = `${GLib.get_tmp_dir()}/compiled.css`
const style = `${GLib.get_tmp_dir()}/main.css`

const regex = /^@define-color\s+(\w+)\s+(.+?);$/gm

AstalIO.monitor_file('./style', (f: string, event: Gio.FileMonitorEvent) => {
  if (event == Gio.FileMonitorEvent.CHANGED && !f.endsWith('ts')) {
    compileCss()
      .then(() => {
        App.reset_css()
        App.apply_css(style)
      })
      .catch()
  }
})

async function compileCss() {
  const gtk_colors = (await readFileAsync('./style/gtk_colors.css')).concat(
    await readFileAsync('./style/dyn.css'),
  )
  const gtk_color_bindings = gtk_colors
    .split('\n')
    .filter(s => s.startsWith('@define-color'))
    .map(s => '$' + s.replace(regex, '$1: "@$1";'))
    .join('\n')

  await execAsync('rm -rf /tmp/style/')
  await execAsync('mkdir /tmp/style/')
  const scss_files_promises = (await execAsync('bash scripts/findstyles.sh'))
    .split(/\s+/)
    .map(async f => {
      await execAsync(`cp ${f} /tmp/style/`)
      return `@import '${f}';`
    })

  const scss_files = (await Promise.all(scss_files_promises)).join('\n')

  await writeFileAsync(sass_input, gtk_color_bindings + '\n' + scss_files)
  await execAsync(`sass ${sass_input} ${sass}`)
  const compiled = await readFileAsync(sass)
  await writeFileAsync(style, gtk_colors + '\n' + compiled)
}

await compileCss()

export default style
