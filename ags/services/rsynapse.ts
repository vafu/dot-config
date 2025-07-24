import { GLib } from 'astal'
import Gio from 'gi://Gio'
import { BehaviorSubject } from 'rxjs'
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators'

// This defines the structure of a single result object
// that the UI will receive.
export type RsynapseResult = {
  id: string
  title: string
  description: string
  icon: string
  command: string
}

// This is the main interface for our service wrapper.
export interface RsynapseService {
  // A stream of the latest search results.
  results: BehaviorSubject<RsynapseResult[]>

  // A method to trigger a new search.
  search: (query: string) => void
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
    </interface>
</node>
`

// A factory function that creates a proxy object from the XML interface.
const RsynapseProxy = Gio.DBusProxy.makeProxyWrapper(RsynapseIface)

// The main function to get an instance of our service wrapper.
export const getRsynapseService = (): RsynapseService => {
  // Create the low-level proxy to the D-Bus service.
  const proxy = RsynapseProxy(
    Gio.DBus.session,
    'com.rsynapse.Engine', // The service name
    '/org/rsynapse/Engine1' // The object path
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
      debounceTime(150), // Wait for 150ms of silence before searching
      distinctUntilChanged(), // Don't search if the query hasn't changed
      switchMap(async (query) => {
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
            null
          )


          // The actual return value is the first element of the variant tuple.
          // We unpack it to get a native JavaScript array.
          const [unpackedResults] = variant.deep_unpack()

          // GJS unpacks a D-Bus array of structs into a JS array of arrays.
          // We need to map this to our desired array of objects.
          const results: RsynapseResult[] = unpackedResults.map(
            (item: string[]) => ({
              id: item[0],
              title: item[1],
              description: item[2],
              icon: item[3],
              command: item[4],
            })
          )
          return results
        } catch (e) {
          console.error('Rsynapse D-Bus call failed:', e)
          return []
        }
      })
    )
    .subscribe((results) => {
      // Push the new results into our main results subject.
      resultsSubject.next(results)
    })

  return {
    results: resultsSubject,
    search: (query: string) => querySubject.next(query),
  }
}
