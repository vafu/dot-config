import { Gtk } from 'ags/gtk4'
import { combineLatest, map, distinctUntilChanged } from 'rxjs'
import { bindAs } from 'rxbinding'
import { firstProjectName } from 'services/locus'
import { locus } from 'services/locus.generated'
import { MaterialIcon } from 'widgets/materialicon'
import { WidgetProps } from 'widgets'

export const LocusProjectWidget = (props: WidgetProps) => {
  const selectedProject$ = locus.selectedProjectString$()
  const selectedProjectProperties$ = locus.pathProperties$('selected-project')
  const cssClasses = (props.cssClasses ?? []).concat(['locus-project-widget'])

  const visible$ = selectedProject$.pipe(
    map(project => !!project),
    distinctUntilChanged(),
  )
  const icon$ = selectedProjectProperties$.pipe(
    map(properties => properties.icon || properties['icon-name'] || properties.symbolicIcon || 'folder_code'),
    distinctUntilChanged(),
  )
  const name$ = combineLatest([selectedProject$, selectedProjectProperties$]).pipe(
    map(([project, properties]) => project ? firstProjectName(project, properties) : ''),
    distinctUntilChanged(),
  )
  const tooltip$ = combineLatest([selectedProject$, selectedProjectProperties$]).pipe(
    map(([project, properties]) => {
      if (!project) return ''
      const metadata = Object.entries(properties)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}: ${value}`)
      return [project, ...metadata].join('\n')
    }),
    distinctUntilChanged(),
  )

  return (
    <box
      cssClasses={cssClasses}
      spacing={4}
      visible={bindAs(visible$, v => v, false)}
      tooltipText={bindAs(tooltip$, v => v, '')}
    >
      <MaterialIcon icon={bindAs(icon$, v => v, 'folder_code')} tinted={false} />
      <label
        label={bindAs(name$, v => v, '')}
        ellipsize={3}
        maxWidthChars={22}
      />
    </box>
  ) as Gtk.Box
}
