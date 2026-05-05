import { Gtk } from 'ags/gtk4'
import { map, distinctUntilChanged } from 'rxjs'
import { bindAs } from 'rxbinding'
import { getLocusService } from 'services/locus'
import { MaterialIcon } from 'widgets/materialicon'
import { WidgetProps } from 'widgets'

export const LocusProjectWidget = (props: WidgetProps) => {
  const activeProject$ = getLocusService().activeProject$
  const cssClasses = (props.cssClasses ?? []).concat(['locus-project-widget'])

  const visible$ = activeProject$.pipe(
    map(project => project != null),
    distinctUntilChanged(),
  )
  const icon$ = activeProject$.pipe(
    map(project => project?.icon || 'folder_code'),
    distinctUntilChanged(),
  )
  const name$ = activeProject$.pipe(
    map(project => project?.name || ''),
    distinctUntilChanged(),
  )
  const tooltip$ = activeProject$.pipe(
    map(project => {
      if (!project) return ''
      const metadata = Object.entries(project.properties)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}: ${value}`)
      return [project.subject, ...metadata].join('\n')
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
