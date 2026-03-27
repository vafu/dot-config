import GLib from 'gi://GLib?version=2.0'
import GObject from 'gi://GObject?version=2.0'
import Gio from 'gi://Gio?version=2.0'
import { BehaviorSubject, Observable } from 'rxjs'
import { distinctUntilChanged, switchMap } from 'rxjs/operators'

export interface RsynapseService {
  results: Observable<RsynapseResult[]>
  search: (query: string) => void
  execute: (result: RsynapseResult) => void
}

export class RsynapseResult extends GObject.Object {
  // Define the GObject properties that will hold our data.
  static {
    GObject.registerClass(
      {
        Properties: {
          id: GObject.ParamSpec.string(
            'id',
            'ID',
            'Result ID',
            GObject.ParamFlags.READWRITE,
            null,
          ),
          title: GObject.ParamSpec.string(
            'title',
            'Title',
            'Result Title',
            GObject.ParamFlags.READWRITE,
            null,
          ),
          description: GObject.ParamSpec.string(
            'description',
            'Description',
            'Result Description',
            GObject.ParamFlags.READWRITE,
            null,
          ),
          icon: GObject.ParamSpec.string(
            'icon',
            'Icon',
            'Result Icon Name',
            GObject.ParamFlags.READWRITE,
            null,
          ),
          data: GObject.ParamSpec.string(
            'data',
            'Data',
            'Result Data',
            GObject.ParamFlags.READWRITE,
            null,
          ),
        },
      },
      this,
    )
  }

  // Declare the properties for TypeScript's type system.
  id: string
  title: string
  description: string
  icon: string
  data: string

  constructor(item: any) {
    super()
    this.id = item.id
    this.title = item.title
    this.description = item.description
    this.icon = item.icon
    this.data = item.data
  }

  public execute(proxy: any) {
    try {
      proxy.call_sync(
        'Execute',
        new GLib.Variant('(s)', [this.id]),
        null,
        1000,
        null,
      )
    } catch (e) {
      console.error('Rsynapse Execute failed:', e)
    }
  }
}

// The D-Bus Introspection XML that describes our service's interface.
// This matches the `DbusResultItem` struct in the Rust daemon.
// The signature `a(sssss)` means "array of (string, string, string, string, string)".
const RsynapseIface = `
<node>
    <interface name="org.rsynapse.Engine1">
        <method name="Search">
            <arg type="s" name="query" direction="in"/>
            <arg type="a(sssss)" name="results" direction="out"/>
        </method>
        <method name="Execute">
            <arg type="s" name="id" direction="in"/>
            <arg type="s" name="result" direction="out"/>
        </method>
    </interface>
</node>
`

// A factory function that creates a proxy object from the XML interface.
const RsynapseProxy = Gio.DBusProxy.makeProxyWrapper(RsynapseIface)

// The main function to get an instance of our service wrapper.
const initRsynapse = (): RsynapseService => {
  // Create the low-level proxy to the D-Bus service.
  const proxy = RsynapseProxy(
    Gio.DBus.session,
    'com.rsynapse.Engine', // The service name
    '/org/rsynapse/Engine1', // The object path
  )

  // A subject to manage the query string. Using a BehaviorSubject
  // allows us to easily control the flow of search requests.
  const querySubject = new BehaviorSubject<string>('')

  // The main results stream. This is what the UI will subscribe to.
  const resultsSubject = new BehaviorSubject<RsynapseResult[]>([])

  // This is the reactive core. It listens for changes to the query,
  // debounces them to avoid excessive D-Bus calls while typing,
  // and then calls the backend to get new results.
  querySubject
    .pipe(
      distinctUntilChanged(), // Don't search if the query hasn't changed
      switchMap(async query => {
        // Cancel previous requests and run a new one
        if (query.trim() === '') {
          return [] // Return empty results for an empty query
        }
        try {
          const variant = proxy.call_sync(
            'Search',
            new GLib.Variant('(s)', [query]),
            null,
            1000,
            null,
          )

          // The actual return value is the first element of the variant tuple.
          // We unpack it to get a native JavaScript array.
          const [unpackedResults] = variant.deep_unpack()

          // GJS unpacks a D-Bus array of structs into a JS array of arrays.
          // We need to map this to our desired array of objects.
          const results: RsynapseResult[] = unpackedResults.map(
            (item: string[]) =>
              new RsynapseResult({
                id: item[0],
                title: item[1],
                description: item[2],
                icon: item[3],
                data: item[4],
              }),
          )
          return results
        } catch (e) {
          console.error('Rsynapse D-Bus call failed:', e)
          return []
        }
      }),
    )
    .subscribe(results => {
      // Push the new results into our main results subject.
      resultsSubject.next(results)
    })

  return {
    results: resultsSubject,
    search: (query: string) => querySubject.next(query),
    execute: (result: RsynapseResult) => result.execute(proxy),
  }
}

let rsynapse: RsynapseService

export function getRsynapseService() {
  if (!rsynapse) {
    rsynapse = initRsynapse()
  }
  return rsynapse
}
