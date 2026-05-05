import Gio from 'gi://Gio?version=2.0'
import GLib from 'gi://GLib?version=2.0'
import { BehaviorSubject, Observable } from 'rxjs'

export interface LocusProject {
  subject: string
  name: string
  icon: string
  path: string
  properties: Record<string, string>
}

export interface LocusService {
  activeProject$: Observable<LocusProject | null>
  refreshActiveProject: () => void
  getTargets: (source: string, relation: string, callback: (targets: string[]) => void) => void
  getSources: (target: string, relation: string, callback: (sources: string[]) => void) => void
  getProperties: (subject: string, callback: (properties: Record<string, string>) => void) => void
  setContextLink: (context: string, relation: string, target: string) => void
  clearContextLink: (context: string, relation: string) => void
}

const BUS_NAME = 'io.github.Locus'
const ROOT_PATH = '/io/github/Locus'
const GRAPH_IFACE = 'io.github.Locus.Graph'
const ACTIVE_CONTEXT = 'active'
const PROJECT_RELATION = 'project'

let service: LocusService | null = null

function call<T>(
  method: string,
  params: GLib.Variant | null,
  resultType: string,
  unpack: (result: any) => T,
  callback: (value: T) => void,
  fallback: T,
) {
  Gio.DBus.session.call(
    BUS_NAME,
    ROOT_PATH,
    GRAPH_IFACE,
    method,
    params,
    new GLib.VariantType(resultType),
    Gio.DBusCallFlags.NONE,
    -1,
    null,
    (_conn: any, res: any) => {
      try {
        callback(unpack(Gio.DBus.session.call_finish(res).deepUnpack()))
      } catch (e) {
        console.error(`[Locus] ${method} failed:`, e)
        callback(fallback)
      }
    },
  )
}

function firstProjectName(project: string, properties: Record<string, string>) {
  return properties.name || properties.path?.split('/').filter(Boolean).pop() || project
}

function toProject(subject: string, properties: Record<string, string>): LocusProject {
  return {
    subject,
    name: firstProjectName(subject, properties),
    icon: properties.icon || 'folder_code',
    path: properties.path || '',
    properties,
  }
}

export function getLocusService(): LocusService {
  if (service) return service

  const activeProject$ = new BehaviorSubject<LocusProject | null>(null)

  const getTargets = (source: string, relation: string, callback: (targets: string[]) => void) => {
    call(
      'GetTargets',
      new GLib.Variant('(ss)', [source, relation]),
      '(as)',
      ([targets]) => targets as string[],
      callback,
      [],
    )
  }

  const getSources = (target: string, relation: string, callback: (sources: string[]) => void) => {
    call(
      'GetSources',
      new GLib.Variant('(ss)', [target, relation]),
      '(as)',
      ([sources]) => sources as string[],
      callback,
      [],
    )
  }

  const getContextTargets = (
    context: string,
    relation: string,
    callback: (targets: string[]) => void,
  ) => {
    call(
      'GetContextTargets',
      new GLib.Variant('(ss)', [context, relation]),
      '(as)',
      ([targets]) => targets as string[],
      callback,
      [],
    )
  }

  const setContextLink = (context: string, relation: string, target: string) => {
    Gio.DBus.session.call(
      BUS_NAME,
      ROOT_PATH,
      GRAPH_IFACE,
      'SetContextLink',
      new GLib.Variant('(sssb)', [context, relation, target, false]),
      null,
      Gio.DBusCallFlags.NONE,
      -1,
      null,
      (_conn: any, res: any) => {
        try {
          Gio.DBus.session.call_finish(res)
        } catch (e) {
          console.error('[Locus] SetContextLink failed:', e)
        }
      },
    )
  }

  const clearContextLink = (context: string, relation: string) => {
    Gio.DBus.session.call(
      BUS_NAME,
      ROOT_PATH,
      GRAPH_IFACE,
      'RemoveLinks',
      new GLib.Variant('(ss)', [`context:${context}`, relation]),
      null,
      Gio.DBusCallFlags.NONE,
      -1,
      null,
      (_conn: any, res: any) => {
        try {
          Gio.DBus.session.call_finish(res)
        } catch (e) {
          console.error('[Locus] RemoveLinks failed:', e)
        }
      },
    )
  }

  const getProperties = (
    subject: string,
    callback: (properties: Record<string, string>) => void,
  ) => {
    call(
      'GetProperties',
      new GLib.Variant('(s)', [subject]),
      '(a{ss})',
      ([properties]) => properties as Record<string, string>,
      callback,
      {},
    )
  }

  const refreshActiveProject = () => {
    getContextTargets(ACTIVE_CONTEXT, PROJECT_RELATION, targets => {
      const project = targets[0] || ''
      if (!project) {
        activeProject$.next(null)
        return
      }

      getProperties(project, properties => {
        activeProject$.next(toProject(project, properties))
      })
    })
  }

  Gio.DBus.session.signal_subscribe(
    BUS_NAME,
    GRAPH_IFACE,
    null,
    null,
    null,
    Gio.DBusSignalFlags.NONE,
    (_conn: any, _sender: any, _path: any, _iface: any, signal: string, params: any) => {
      const unpacked = params.deepUnpack()
      if (signal === 'LinkAdded' || signal === 'LinkRemoved') {
        const [source, relation] = unpacked as [string, string, string]
        if (source === 'context:active' && relation === PROJECT_RELATION) {
          refreshActiveProject()
        }
      } else if (signal === 'PropertyChanged' || signal === 'PropertyRemoved') {
        const [subject] = unpacked as [string, string, string?]
        if (subject === activeProject$.value?.subject) {
          refreshActiveProject()
        }
      }
    },
  )

  refreshActiveProject()

  service = {
    activeProject$,
    refreshActiveProject,
    getTargets,
    getSources,
    getProperties,
    setContextLink,
    clearContextLink,
  }
  return service
}
