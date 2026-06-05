import { Gtk } from 'ags/gtk4'
import { combineLatest, map, distinctUntilChanged, Observable } from 'rxjs'
import { bindAs } from 'rxbinding'
import { firstProjectName } from 'services/locus'
import { locus } from 'services/locus.generated'
import { MaterialIcon } from 'widgets/materialicon'
import { WidgetProps } from 'widgets'

type SimpleProjectChipProps = WidgetProps & {
  icon$: Observable<string>
  primary$: Observable<string>
  secondary$: Observable<string>
  visible$: Observable<boolean>
  tooltip$: Observable<string>
}

const selectedProject$ = locus.selectedProjectString$()
const selectedProjectProperties$ = locus.pathProperties$('selected-project')

const visible$ = selectedProject$.pipe(
  map(project => !!project),
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

const projectIcon$ = selectedProjectProperties$.pipe(
  map(properties => properties.icon || properties['icon-name'] || properties.symbolicIcon || 'folder_code'),
  distinctUntilChanged(),
)

const projectName$ = combineLatest([selectedProject$, selectedProjectProperties$]).pipe(
  map(([project, properties]) => project ? firstProjectName(project, properties).trim() : ''),
  distinctUntilChanged(),
)

const branch$ = selectedProjectProperties$.pipe(
  map(properties => (properties.branch || '').trim()),
  distinctUntilChanged(),
)

const subproj$ = selectedProjectProperties$.pipe(
  map(properties => (properties.subproj || '').trim()),
  distinctUntilChanged(),
)

const task$ = selectedProjectProperties$.pipe(
  map(properties => (properties.task || '').trim()),
  distinctUntilChanged(),
)

const projectSecondary$ = combineLatest([subproj$, branch$]).pipe(
  map(([subproj, branch]) => subproj ? '' : branch),
  distinctUntilChanged(),
)

const contextVisible$ = subproj$.pipe(
  map(subproj => !!subproj),
  distinctUntilChanged(),
)


const contextIcon$ = selectedProjectProperties$.pipe(
  map(properties => properties['display-icon'] || 'folder_code'),
  distinctUntilChanged(),
)

export const SimpleProjectChip = (props: SimpleProjectChipProps) => {
  const cssClasses = (props.cssClasses ?? []).concat(['locus-project-chip'])

  return (
    <box
      cssClasses={cssClasses}
      spacing={4}
      visible={bindAs(props.visible$, v => v, false)}
      tooltipText={bindAs(props.tooltip$, v => v, '')}
    >
      <MaterialIcon icon={bindAs(props.icon$, v => v, 'folder_code')} tinted={false} />
      <label
        label={bindAs(props.primary$, v => v, '')}
        ellipsize={3}
        maxWidthChars={22}
        cssClasses={['locus-project-primary']}
      />
      <label
        label="·"
        visible={bindAs(props.secondary$, v => !!v, false)}
        cssClasses={['locus-project-delimiter']}
      />
      <label
        label={bindAs(props.secondary$, v => v, '')}
        visible={bindAs(props.secondary$, v => !!v, false)}
        ellipsize={3}
        maxWidthChars={18}
        cssClasses={['locus-project-secondary']}
      />
    </box>
  ) as Gtk.Box
}

export const LocusProjectChip = (props: WidgetProps) => (
  <SimpleProjectChip
    cssClasses={props.cssClasses ?? []}
    icon$={projectIcon$}
    primary$={projectName$}
    secondary$={projectSecondary$}
    visible$={visible$}
    tooltip$={tooltip$}
  />
) as Gtk.Box

export const LocusContextChip = (props: WidgetProps) => (
  <SimpleProjectChip
    cssClasses={(props.cssClasses ?? []).concat(['locus-context-chip'])}
    icon$={contextIcon$}
    primary$={subproj$}
    secondary$={task$}
    visible$={contextVisible$}
    tooltip$={tooltip$}
  />
) as Gtk.Box

export const LocusProjectWidget = (props: WidgetProps) => (
  <box
    cssClasses={(props.cssClasses ?? []).concat(['locus-project-widget'])}
    spacing={4}
    visible={bindAs(visible$, v => v, false)}
  >
    <LocusProjectChip />
    <MaterialIcon
      icon="chevron_right"
      tinted={false}
      visible={bindAs(contextVisible$, v => v, false)}
      cssClasses={['locus-project-group-delimiter']}
    />
    <LocusContextChip />
  </box>
) as Gtk.Box
