import { BehaviorSubject, Observable, distinctUntilChanged, shareReplay } from 'rxjs'
import {
  LocusDbusClient,
  path as schemaPath,
  type NamedPath,
  type NodeId,
  type OptionalNodeId,
  type PropertyKey,
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
  getProperty: (subject: string, key: string, callback: (value: string) => void) => void
  getProperties: (subject: string, callback: (properties: Record<string, string>) => void) => void
  resolve: (source: string, path: string[], callback: (subject: string) => void) => void
  path$: (name: NamedPath) => Observable<string>
  resolve$: (source: string, path: string[]) => Observable<string>
  property$: (subject: string, key: string) => Observable<string>
  sources$: (target: string, relation: string) => Observable<string[]>
  targets$: (source: string, relation: string) => Observable<string[]>
  setContextLink: (context: string, relation: string, target: string) => void
  clearContextLink: (context: string, relation: string) => void
}

const TRACE_DBUS_LATENCY = true

let service: LocusService | null = null

function contextSubject(context: string) {
  return `context:${context}`
}

function present(value: OptionalNodeId) {
  return value ?? ''
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

function callbackError(scope: string, error: unknown) {
  console.error(`[Locus] ${scope} failed:`, error)
}

export function getLocusService(): LocusService {
  if (service) return service

  const client = new LocusDbusClient({ traceLatency: TRACE_DBUS_LATENCY })
  const pathCache = new Map<string, Observable<string>>()
  const resolveCache = new Map<string, Observable<string>>()
  const propertyCache = new Map<string, Observable<string>>()
  const sourcesCache = new Map<string, Observable<string[]>>()
  const targetsCache = new Map<string, Observable<string[]>>()

  const path$ = (name: NamedPath) => {
    const cached = pathCache.get(name)
    if (cached) return cached
    const spec = schemaPath(name)
    const observable = resolve$(spec.from, spec.path)
    pathCache.set(name, observable)
    return observable
  }

  const resolve$ = (source: string, path: string[]) => {
    const key = `${source}\0${path.join('\0')}`
    const cached = resolveCache.get(key)
    if (cached) return cached

    const observable = new Observable<string>(subscriber => {
      let closed = false
      let unsubscribeTarget: (() => void) | null = null
      let watch: { close: () => Promise<void>; onTargetChanged: (handler: (target: OptionalNodeId) => void) => () => void; target: () => Promise<OptionalNodeId> } | null = null

      client.watchNode(source, path as Relation[])
        .then(created => {
          if (closed) {
            created.close().catch(error => callbackError('Watch.Close', error))
            return
          }
          watch = created
          unsubscribeTarget = created.onTargetChanged(target => subscriber.next(present(target)))
          return created.target()
        })
        .then(target => {
          if (!closed && target !== undefined) subscriber.next(present(target))
        })
        .catch(error => {
          callbackError('WatchNode', error)
          subscriber.next('')
        })

      return () => {
        closed = true
        unsubscribeTarget?.()
        watch?.close().catch(error => callbackError('Watch.Close', error))
        resolveCache.delete(key)
      }
    }).pipe(distinctUntilChanged(), shareReplay({ bufferSize: 1, refCount: true }))

    resolveCache.set(key, observable)
    return observable
  }

  const property$ = (subject: string, key: string) => {
    const cacheKey = `${subject}\0${key}`
    const cached = propertyCache.get(cacheKey)
    if (cached) return cached

    const observable = new Observable<string>(subscriber => {
      if (!subject) {
        subscriber.next('')
        return undefined
      }

      client.property(subject, key as PropertyKey)
        .then(value => subscriber.next(present(value)))
        .catch(error => {
          callbackError('GetProperty', error)
          subscriber.next('')
        })

      const unsubscribeChanged = client.onPropertyChanged(signal => {
        if (signal.subject === subject && signal.key === key) subscriber.next(signal.value)
      })
      const unsubscribeRemoved = client.onPropertyRemoved(signal => {
        if (signal.subject === subject && signal.key === key) subscriber.next('')
      })

      return () => {
        unsubscribeChanged()
        unsubscribeRemoved()
        propertyCache.delete(cacheKey)
      }
    }).pipe(distinctUntilChanged(), shareReplay({ bufferSize: 1, refCount: true }))

    propertyCache.set(cacheKey, observable)
    return observable
  }

  const sources$ = (target: string, relation: string) => {
    const cacheKey = `${target}\0${relation}`
    const cached = sourcesCache.get(cacheKey)
    if (cached) return cached

    const observable = new Observable<string[]>(subscriber => {
      const refresh = () => {
        client.sources(target, relation as Relation)
          .then(sources => subscriber.next(sources))
          .catch(error => {
            callbackError('GetSources', error)
            subscriber.next([])
          })
      }

      refresh()
      const unsubscribeAdded = client.onLinkAdded(signal => {
        if (signal.relation === relation && signal.target === target) refresh()
      })
      const unsubscribeRemoved = client.onLinkRemoved(signal => {
        if (signal.relation === relation && signal.target === target) refresh()
      })
      const unsubscribeSet = client.onLinkSet(signal => {
        if (signal.relation === relation && (signal.target === target || signal.oldTargets.includes(target))) refresh()
      })

      return () => {
        unsubscribeAdded()
        unsubscribeRemoved()
        unsubscribeSet()
        sourcesCache.delete(cacheKey)
      }
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }))

    sourcesCache.set(cacheKey, observable)
    return observable
  }

  const targets$ = (source: string, relation: string) => {
    const cacheKey = `${source}\0${relation}`
    const cached = targetsCache.get(cacheKey)
    if (cached) return cached

    const observable = new Observable<string[]>(subscriber => {
      const refresh = () => {
        client.targets(source, relation as Relation)
          .then(targets => subscriber.next(targets))
          .catch(error => {
            callbackError('GetTargets', error)
            subscriber.next([])
          })
      }

      refresh()
      const unsubscribeAdded = client.onLinkAdded(signal => {
        if (signal.relation === relation && signal.source === source) refresh()
      })
      const unsubscribeRemoved = client.onLinkRemoved(signal => {
        if (signal.relation === relation && signal.source === source) refresh()
      })
      const unsubscribeSet = client.onLinkSet(signal => {
        if (signal.relation === relation && signal.source === source) refresh()
      })

      return () => {
        unsubscribeAdded()
        unsubscribeRemoved()
        unsubscribeSet()
        targetsCache.delete(cacheKey)
      }
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }))

    targetsCache.set(cacheKey, observable)
    return observable
  }

  const activeProject$ = new BehaviorSubject<LocusProject | null>(null)
  const setActiveProject = (project: string) => {
    if (!project) {
      activeProject$.next(null)
      return
    }

    client.properties(project)
      .then(properties => activeProject$.next(toProject(project, properties)))
      .catch(error => {
        callbackError('GetProperties', error)
        activeProject$.next(null)
      })
  }

  const refreshActiveProject = () => {
    client.resolvePath('selected-project')
      .then(project => setActiveProject(present(project)))
      .catch(error => {
        callbackError('ResolvePath(selected-project)', error)
        setActiveProject('')
      })
  }

  path$('selected-project').subscribe(setActiveProject)

  service = {
    activeProject$,
    selectedWorkspace$: path$('selected-workspace'),
    selectedWindow$: path$('selected-window'),
    refreshActiveProject,
    getTargets(source, relation, callback) {
      client.targets(source, relation as Relation)
        .then(callback)
        .catch(error => {
          callbackError('GetTargets', error)
          callback([])
        })
    },
    getSources(target, relation, callback) {
      client.sources(target, relation as Relation)
        .then(callback)
        .catch(error => {
          callbackError('GetSources', error)
          callback([])
        })
    },
    getProperty(subject, key, callback) {
      client.property(subject, key as PropertyKey)
        .then(value => callback(present(value)))
        .catch(error => {
          callbackError('GetProperty', error)
          callback('')
        })
    },
    getProperties(subject, callback) {
      client.properties(subject)
        .then(callback)
        .catch(error => {
          callbackError('GetProperties', error)
          callback({})
        })
    },
    resolve(source, path, callback) {
      client.resolve(source, path as Relation[])
        .then(target => callback(present(target)))
        .catch(error => {
          callbackError('Resolve', error)
          callback('')
        })
    },
    path$,
    resolve$,
    property$,
    sources$,
    targets$,
    setContextLink(context, relation, target) {
      client.setLink(contextSubject(context), relation as Relation, target)
        .catch(error => callbackError('SetLink', error))
    },
    clearContextLink(context, relation) {
      client.removeLinks(contextSubject(context), relation as Relation)
        .catch(error => callbackError('RemoveLinks', error))
    },
  }

  return service
}
