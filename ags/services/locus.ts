import Gio from 'gi://Gio?version=2.0'
import GLib from 'gi://GLib?version=2.0'
import { BehaviorSubject, Observable } from 'rxjs'
import {
  LocusSchemaClient,
  locusSchema,
  type LocusDbusClient,
  type NamedPath,
  type Relation,
} from './locus.generated'

export interface LocusProject {
  subject: string
  name: string
  icon: string
  path: string
  properties: Record<string, string>
}

export interface LocusService {
  activeProject$: Observable<LocusProject | null>
  selectedWorkspace$: Observable<string>
  selectedWindow$: Observable<string>
  refreshActiveProject: () => void
  getTargets: (source: string, relation: string, callback: (targets: string[]) => void) => void
  getSources: (target: string, relation: string, callback: (sources: string[]) => void) => void
  getProperties: (subject: string, callback: (properties: Record<string, string>) => void) => void
  resolve: (source: string, path: string[], callback: (subject: string) => void) => void
  subscribeResolve: (source: string, path: string[], callback: (subject: string) => void) => void
  setContextLink: (context: string, relation: string, target: string) => void
  clearContextLink: (context: string, relation: string) => void
}

const BUS_NAME = 'io.github.Locus'
const ROOT_PATH = '/io/github/Locus'
const GRAPH_IFACE = 'io.github.Locus.Graph'
const SELECTED_CONTEXT = 'selected'
const PROJECT_RELATION: Relation = 'project'
const WORKSPACE_RELATION: Relation = 'workspace'
const WINDOW_RELATION: Relation = 'window'
const SELECTED_SUBJECT = `context:${SELECTED_CONTEXT}`
const SELECTED_WORKSPACE_PATH_NAME: NamedPath = 'selected-workspace'
const SELECTED_PROJECT_PATH_NAME: NamedPath = 'selected-project'
const SELECTED_WORKSPACE_PATH = [...locusSchema.paths[SELECTED_WORKSPACE_PATH_NAME].path]
const SELECTED_PROJECT_PATH = [...locusSchema.paths[SELECTED_PROJECT_PATH_NAME].path]

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

function callPromise<T>(
  method: string,
  params: GLib.Variant | null,
  resultType: string | null,
  unpack: (result: any) => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    Gio.DBus.session.call(
      BUS_NAME,
      ROOT_PATH,
      GRAPH_IFACE,
      method,
      params,
      resultType ? new GLib.VariantType(resultType) : null,
      Gio.DBusCallFlags.NONE,
      -1,
      null,
      (_conn: any, res: any) => {
        try {
          const result = Gio.DBus.session.call_finish(res)
          resolve(unpack(result.deepUnpack()))
        } catch (e) {
          console.error(`[Locus] ${method} failed:`, e)
          reject(e)
        }
      },
    )
  })
}

function createDbusClient(): LocusDbusClient {
  return {
    setLink(source, relation, target) {
      return callPromise('SetLink', new GLib.Variant('(sss)', [source, relation, target]), null, () => undefined)
    },
    removeLink(source, relation, target) {
      return callPromise('RemoveLink', new GLib.Variant('(sss)', [source, relation, target]), null, () => undefined)
    },
    getTargets(source, relation) {
      return callPromise('GetTargets', new GLib.Variant('(ss)', [source, relation]), '(as)', ([targets]) => targets as string[])
    },
    getSources(target, relation) {
      return callPromise('GetSources', new GLib.Variant('(ss)', [target, relation]), '(as)', ([sources]) => sources as string[])
    },
    setProperty(subject, key, value) {
      return callPromise('SetProperty', new GLib.Variant('(sss)', [subject, key, value]), null, () => undefined)
    },
    getProperty(subject, key) {
      return callPromise('GetProperty', new GLib.Variant('(ss)', [subject, key]), '(s)', ([value]) => value as string)
    },
    getProperties(subject) {
      return callPromise('GetProperties', new GLib.Variant('(s)', [subject]), '(a{ss})', ([properties]) => properties as Record<string, string>)
    },
    resolve(source, path) {
      return callPromise('Resolve', new GLib.Variant('(sas)', [source, path]), '(s)', ([subject]) => subject as string)
    },
    resolveAll(source, path) {
      return callPromise('ResolveAll', new GLib.Variant('(sas)', [source, path]), '(as)', ([subjects]) => subjects as string[])
    },
    subscribeResolve(source, path) {
      return callPromise('SubscribeResolve', new GLib.Variant('(sas)', [source, path]), '(s)', ([subject]) => subject as string)
    },
  }
}

function firstProjectName(project: string, properties: Record<string, string>) {
  return properties.displayName
    || properties['display-name']
    || properties.title
    || properties.name
    || properties.path?.split('/').filter(Boolean).pop()
    || project
}

function toProject(subject: string, properties: Record<string, string>): LocusProject {
  return {
    subject,
    name: firstProjectName(subject, properties),
    icon: properties.icon || properties['icon-name'] || properties.symbolicIcon || 'folder_code',
    path: properties.path || '',
    properties,
  }
}

function samePath(left: string[], right: string[]) {
  return left.length === right.length && left.every((part, index) => part === right[index])
}

export function getLocusService(): LocusService {
  if (service) return service

  const activeProject$ = new BehaviorSubject<LocusProject | null>(null)
  const selectedWorkspace$ = new BehaviorSubject('')
  const selectedWindow$ = new BehaviorSubject('')
  const schemaClient = new LocusSchemaClient(createDbusClient())

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
      'GetTargets',
      new GLib.Variant('(ss)', [`context:${context}`, relation]),
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
      'SetLink',
      new GLib.Variant('(sss)', [`context:${context}`, relation, target]),
      null,
      Gio.DBusCallFlags.NONE,
      -1,
      null,
      (_conn: any, res: any) => {
        try {
          Gio.DBus.session.call_finish(res)
        } catch (e) {
          console.error('[Locus] SetLink failed:', e)
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

  const resolve = (
    source: string,
    path: string[],
    callback: (subject: string) => void,
  ) => {
    call(
      'Resolve',
      new GLib.Variant('(sas)', [source, path]),
      '(s)',
      ([subject]) => subject as string,
      callback,
      '',
    )
  }

  const subscribeResolve = (
    source: string,
    path: string[],
    callback: (subject: string) => void,
  ) => {
    call(
      'SubscribeResolve',
      new GLib.Variant('(sas)', [source, path]),
      '(s)',
      ([subject]) => subject as string,
      subject => {
        console.log(`[Locus] SubscribeResolve initial ${source} path=${path.join('>') || '<self>'} target=${subject || '<none>'}`)
        callback(subject)
      },
      '',
    )
  }

  const setActiveProject = (project: string) => {
    if (!project) {
      activeProject$.next(null)
      return
    }

    getProperties(project, properties => {
      activeProject$.next(toProject(project, properties))
    })
  }

  const refreshActiveProject = () => {
    schemaClient.selectedProject()
      .then(project => setActiveProject(project ?? ''))
      .catch(() => setActiveProject(''))
  }

  const refreshSelectedWorkspace = () => {
    schemaClient.selectedWorkspace()
      .then(workspace => selectedWorkspace$.next(workspace ?? ''))
      .catch(() => selectedWorkspace$.next(''))
  }

  const refreshSelectedWindow = () => {
    getContextTargets(SELECTED_CONTEXT, WINDOW_RELATION, targets => {
      const window = targets[0] || ''
      if (window === selectedWindow$.value) return
      console.log(`[Locus] selected window=${window || '<none>'}`)
      selectedWindow$.next(window)
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
        const [source, relation, target] = unpacked as [string, string, string]
        if (
          signal === 'LinkRemoved'
          && source === SELECTED_SUBJECT
          && relation === WINDOW_RELATION
          && target === selectedWindow$.value
        ) {
          refreshSelectedWindow()
        }
      } else if (signal === 'LinkSet') {
        const [source, relation] = unpacked as [string, string, string[], string]
        if (source === SELECTED_SUBJECT && relation === WINDOW_RELATION) {
          refreshSelectedWindow()
        }
      } else if (signal === 'ResolveChanged') {
        const [source, path, target] = unpacked as [string, string[], string]
        console.log(`[Locus] ResolveChanged ${source} path=${path.join('>') || '<self>'} target=${target || '<none>'}`)
        if (source === SELECTED_SUBJECT && samePath(path, SELECTED_WORKSPACE_PATH)) {
          selectedWorkspace$.next(target)
        } else if (source === SELECTED_SUBJECT && samePath(path, SELECTED_PROJECT_PATH)) {
          setActiveProject(target)
        }
      } else if (signal === 'PropertyChanged' || signal === 'PropertyRemoved') {
        const [subject] = unpacked as [string, string, string?]
        if (subject === activeProject$.value?.subject) {
          refreshActiveProject()
        }
      }
    },
  )

  schemaClient.subscribeSelectedWorkspace()
    .then(workspace => {
      console.log(`[Locus] SubscribeResolve initial ${SELECTED_SUBJECT} path=${SELECTED_WORKSPACE_PATH.join('>')} target=${workspace || '<none>'}`)
      selectedWorkspace$.next(workspace ?? '')
    })
    .catch(() => selectedWorkspace$.next(''))
  schemaClient.subscribeSelectedProject()
    .then(project => {
      console.log(`[Locus] SubscribeResolve initial ${SELECTED_SUBJECT} path=${SELECTED_PROJECT_PATH.join('>')} target=${project || '<none>'}`)
      setActiveProject(project ?? '')
    })
    .catch(() => setActiveProject(''))
  refreshSelectedWindow()

  service = {
    activeProject$,
    selectedWorkspace$,
    selectedWindow$,
    refreshActiveProject,
    getTargets,
    getSources,
    getProperties,
    resolve,
    subscribeResolve,
    setContextLink,
    clearContextLink,
  }
  return service
}
