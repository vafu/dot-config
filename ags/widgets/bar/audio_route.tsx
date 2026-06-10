import AstalWp from 'gi://AstalWp?version=0.1'
import { Gtk } from 'ags/gtk4'
import GLib from 'gi://GLib?version=2.0'
import { execAsync } from 'ags/process'
import { createBinding, For } from 'gnim'
import { bindAs, binding, fromConnectable, fromChain } from 'rxbinding'
import { map, Observable, shareReplay } from 'rxjs'
import Adw from 'gi://Adw?version=1'
import { MaterialIcon } from 'widgets/materialicon'

const wp = AstalWp.get_default()!!
const audio = wp.audio

type PipeWireSinkProps = {
  deviceId: string
  priority: number
}

type PipeWireDumpObject = {
  id: number
  type: string
  info?: {
    props?: Record<string, unknown>
  }
}

let sinkProps = new Map<number, PipeWireSinkProps>()
let refreshInFlight = false

async function refreshSinkProps() {
  if (refreshInFlight) return
  refreshInFlight = true

  try {
    const raw = await execAsync('pw-dump')
    const objects = JSON.parse(raw) as PipeWireDumpObject[]
    const next = new Map<number, PipeWireSinkProps>()

    for (const object of objects) {
      const props = object.info?.props
      if (object.type !== 'PipeWire:Interface:Node' || !props) continue
      if (props['media.class'] !== 'Audio/Sink') continue

      next.set(object.id, {
        deviceId: String(props['device.id'] ?? object.id),
        priority: Number(props['priority.session'] ?? 0),
      })
    }

    sinkProps = next
  } catch (error) {
    console.error(`Failed to refresh PipeWire sink props: ${error}`)
  } finally {
    refreshInFlight = false
  }
}

function currentSpeakers() {
  const speakers = audio.get_speakers() ?? []
  if (sinkProps.size === 0) {
    return speakers.filter(sink => sink.is_default)
  }

  const selectedIds = new Set<number>()
  const bestByDevice = new Map<string, { id: number; priority: number }>()

  for (const sink of speakers) {
    const props = sinkProps.get(sink.id)
    const deviceId = props?.deviceId ?? `sink:${sink.id}`
    const priority = props?.priority ?? 0
    const current = bestByDevice.get(deviceId)

    if (!current || priority > current.priority) {
      bestByDevice.set(deviceId, { id: sink.id, priority })
    }
  }

  for (const best of bestByDevice.values()) {
    selectedIds.add(best.id)
  }

  return speakers
    .filter(sink => selectedIds.has(sink.id) || sink.is_default)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default))
}

const speakers = new Observable<AstalWp.Endpoint[]>(subscriber => {
  const emit = () => subscriber.next(currentSpeakers())
  const deferredEmit = () => {
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      emit()
      void refreshSinkProps().then(emit)
      return GLib.SOURCE_REMOVE
    })
  }

  emit()
  void refreshSinkProps().then(emit)

  const signalIds = [
    audio.connect('speaker-added', deferredEmit),
    audio.connect('speaker-removed', deferredEmit),
    audio.connect('notify::speakers', deferredEmit),
    audio.connect('notify::default-speaker', deferredEmit),
  ]

  return () => signalIds.forEach(id => audio.disconnect(id))
}).pipe(shareReplay({ bufferSize: 1, refCount: true }))

const defaultSpeaker = fromConnectable(audio, 'default_speaker')
export const defaultSpeakerTypeIcon = defaultSpeaker.pipe(map(sinkTypeIcon))
const defaultSpeakerVolumeIcon = fromChain(defaultSpeaker, 'volume_icon')
const defaultSpeakerDescription = fromChain(defaultSpeaker, 'description')

const sinkSubtitle = (sink: AstalWp.Endpoint) =>
  sink.name || `PipeWire endpoint ${sink.id}`

function sinkTypeIcon(sink: AstalWp.Endpoint) {
  const haystack = [sink.icon, sink.name, sink.description]
    .join(' ')
    .toLowerCase()

  if (haystack.includes('headphone') || haystack.includes('headset')) {
    return 'headphones'
  }

  if (haystack.includes('tascam') || haystack.includes('main out')) {
    return 'speaker'
  }

  if (haystack.includes('speaker')) {
    return 'speaker'
  }

  if (haystack.includes('card') || haystack.includes('pci')) {
    return 'settings_input_component'
  }

  return 'speaker'
}

const selectSink = (id: number, popover: Gtk.Popover) => {
  const sink = audio.get_speaker(id)
  if (!sink) return

  sink.set_is_default(true)
  popover.popdown()
}

export const AudioRoutePopover = () => {
  const popover = new Gtk.Popover({
    cssClasses: ['menu', 'audio-route-popover'],
  })

  popover.set_child((
    <box orientation={Gtk.Orientation.VERTICAL} cssClasses={['audio-route']}>
      <label
        cssClasses={['audio-route-title']}
        halign={Gtk.Align.START}
        label="Audio Output"
      />
      <Gtk.ListBox selectionMode={Gtk.SelectionMode.NONE}>
        <For each={binding(speakers, [])}>
          {sink => (
            <Adw.ActionRow
              $={row =>
                row.add_prefix(
                  <MaterialIcon
                    icon={sinkTypeIcon(sink)}
                    tinted={false}
                    style={{ size: 24, fill: false }}
                  />,
                )
              }
              title={createBinding(sink, 'description')}
              subtitle={sinkSubtitle(sink)}
              activatable={true}
              onActivated={() => selectSink(sink.id, popover)}
            >
              <MaterialIcon
                icon="check"
                tinted={false}
                style={{ size: 24, fill: false }}
                visible={createBinding(sink, 'is_default')}
              />
            </Adw.ActionRow>
          )}
        </For>
      </Gtk.ListBox>
    </box>
  ) as Gtk.Widget)

  return popover
}

export const AudioVolumeIndicator = () => (
  <image
    iconName={binding(defaultSpeakerVolumeIcon, 'audio-volume-medium-symbolic')}
    tooltipText={bindAs(defaultSpeakerDescription, d => d, 'Audio Output')}
    cssClasses={['panel-widget']}
  />
)
