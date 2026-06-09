import { Gtk } from 'ags/gtk4'
import { getBzBusService, BzBusFailure, BzBusInvocation, BzBusState } from 'services/bzbus'
import { MaterialIcon } from 'widgets/materialicon'
import { WidgetProps } from 'widgets'
import { bindAs } from 'rxbinding'

const bzbus = getBzBusService()
const liveState$ = bzbus.state$

function statusText(state: BzBusState): string {
  const invocation = state.latest
  if (!state.connected) return 'offline'
  if (!invocation) return 'idle'

  const elapsed = elapsedText(invocation)
  const work = workText(invocation)
  const failures = failureCount(invocation)
  const failurePart = failures > 0 ? ` · ${failures}!` : ''
  const workPart = work ? ` · ${work}` : ''
  return `${invocation.status || 'unknown'} · ${elapsed}${workPart}${failurePart}`
}

function iconFor(state: BzBusState): string {
  const invocation = state.latest
  if (!state.connected) return 'cloud_off'
  if (!invocation) return 'construction'
  if (invocation.status === 'failed' || invocation.outcome === 'failure') return 'error'
  if (invocation.status === 'finished' || invocation.outcome === 'success') return 'check_circle'
  return 'build_circle'
}

function tooltipFor(state: BzBusState): string {
  const invocation = state.latest
  if (!state.connected) return `bzbus offline${state.error ? ` · ${state.error}` : ''}`
  if (!invocation) return 'bzbus connected · no active build'

  const lines = [
    `status: ${invocation.status || 'unknown'} (${invocation.outcome || 'unknown'})`,
    `elapsed: ${elapsedText(invocation)}`,
    `command: ${commandText(invocation)}`,
    `workspace: ${invocation.workspaceDir || invocation.cwd || 'unknown'}`,
    `server: pid ${invocation.serverPid || 'unknown'}${invocation.bazelVersion ? ` · ${invocation.bazelVersion}` : ''}`,
    `targets: ${invocation.targetsTotal} total, ${invocation.targetsFailed} failed`,
    `tests: ${invocation.testsTotal} total, ${invocation.testsFailed} failed`,
    `actions: ${invocation.actionSummary.actionsExecuted || invocation.actionsTotal || invocation.buildProgress.actions} executed, ${invocation.actionSummary.actionsCreated} created, ${invocation.actionsFailed} failed`,
  ]

  if (invocation.buildProgress.total > 0) {
    lines.push(`progress: ${progressText(invocation)}`)
  }

  const timing = timingText(invocation)
  if (timing) lines.push(`timing: ${timing}`)

  const workers = workerText(invocation)
  if (workers) lines.push(`workers: ${workers}`)

  const resources = resourceText(state)
  if (resources) lines.push(`scope: ${resources}`)

  const topMnemonics = invocation.actionSummary.topMnemonics
    .slice(0, 5)
    .filter(item => item.mnemonic)
    .map(item => `${item.mnemonic}:${item.actionsExecuted}`)
    .join(', ')
  if (topMnemonics) lines.push(`top actions: ${topMnemonics}`)

  const runners = invocation.actionSummary.runners
    .slice(0, 4)
    .filter(runner => runner.name)
    .map(runner => `${runner.name}:${runner.count}`)
    .join(', ')
  if (runners) lines.push(`runners: ${runners}`)

  const failures = failureText(invocation.failures)
  if (failures) lines.push(`failures:\n${failures}`)

  if (invocation.failedTargets.length > 0) lines.push(`failed targets: ${invocation.failedTargets.slice(0, 3).join(', ')}`)
  if (invocation.failedTests.length > 0) lines.push(`failed tests: ${invocation.failedTests.slice(0, 3).join(', ')}`)

  const recent = invocation.recentStderr.trim() || invocation.recentStdout.trim()
  if (recent) lines.push(`recent:\n${trimText(recent, 420)}`)

  lines.push(`sequence: ${invocation.lastSequenceNumber}`)
  lines.push(`invocation: ${invocation.id}`)
  lines.push(`build: ${invocation.buildId}`)
  return lines.join('\n')
}

function elapsedText(invocation: BzBusInvocation): string {
  if (invocation.startedAtUnixMs <= 0) return 'unknown'
  const end = invocation.endedAtUnixMs > 0 ? invocation.endedAtUnixMs : Date.now()
  return durationText(end - invocation.startedAtUnixMs)
}

function durationText(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function workText(invocation: BzBusInvocation): string {
  if (invocation.buildProgress.total > 0) return progressText(invocation)
  const executed = invocation.actionSummary.actionsExecuted || invocation.actionsTotal
  if (executed > 0) return `${executed}a`
  if (invocation.targetsTotal > 0) return `${invocation.targetsTotal}t`
  if (invocation.testsTotal > 0) return `${invocation.testsTotal}test`
  return ''
}

function progressText(invocation: BzBusInvocation): string {
  const progress = invocation.buildProgress
  const tasks = `${progress.completed.toLocaleString()}/${progress.total.toLocaleString()}`
  const actions = progress.actions > 0 ? ` · ${progress.actions}a` : ''
  const running = progress.running > 0 ? `/${progress.running}r` : ''
  return `${tasks}${actions}${running}`
}

function failureCount(invocation: BzBusInvocation): number {
  return invocation.targetsFailed + invocation.testsFailed + invocation.actionsFailed
}

function commandText(invocation: BzBusInvocation): string {
  if (invocation.command.length > 0) return trimText(invocation.command.join(' '), 220)
  return invocation.commandName || 'unknown'
}

function timingText(invocation: BzBusInvocation): string {
  const timing = invocation.timing
  const parts = []
  if (timing.wallMs > 0) parts.push(`wall ${durationText(timing.wallMs)}`)
  if (timing.analysisMs > 0) parts.push(`analysis ${durationText(timing.analysisMs)}`)
  if (timing.executionMs > 0) parts.push(`exec ${durationText(timing.executionMs)}`)
  if (timing.cpuMs > 0) parts.push(`cpu ${durationText(timing.cpuMs)}`)
  return parts.join(', ')
}

function workerText(invocation: BzBusInvocation): string {
  const workers = invocation.workerSummary
  if (workers.total <= 0) return ''
  const parts = [`${workers.total} total`]
  if (workers.peakMemoryKb > 0) parts.push(`peak ${formatBytes(workers.peakMemoryKb * 1024)}`)
  if (workers.killedDueToMemoryPressure > 0) parts.push(`${workers.killedDueToMemoryPressure} memory-killed`)
  return parts.join(', ')
}

function resourceText(state: BzBusState): string {
  const resources = state.resources
  if (!resources) return ''
  const parts = []
  if (resources.memoryCurrentBytes > 0) parts.push(`mem ${formatBytes(resources.memoryCurrentBytes)}`)
  if (resources.memoryPeakBytes > 0) parts.push(`peak ${formatBytes(resources.memoryPeakBytes)}`)
  if (resources.pids > 0) parts.push(`${resources.pids} pids`)
  return parts.join(', ')
}

function failureText(failures: BzBusFailure[]): string {
  return failures
    .slice(0, 4)
    .map(failure => {
      const where = failure.label || failure.mnemonic || failure.kind || 'failure'
      const message = failure.message || failure.stderr || failure.stdout || `exit ${failure.exitCode}`
      return `- ${failure.kind || 'failure'} ${trimText(where, 120)}: ${trimText(message, 180)}`
    })
    .join('\n')
}

function trimText(text: string, maxLength: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLength) return oneLine
  return `${oneLine.slice(0, maxLength - 1)}...`
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

function classesFor(state: BzBusState): string[] {
  const invocation = state.latest
  const classes = ['bzbus-widget']
  if (!state.connected) return classes.concat(['offline'])
  if (!invocation) return classes.concat(['idle'])
  if (invocation.status === 'failed' || invocation.outcome === 'failure') return classes.concat(['failed'])
  if (invocation.status === 'finished' || invocation.outcome === 'success') return classes.concat(['finished'])
  return classes.concat(['running'])
}

export const BzBusWidget = (props: WidgetProps) => (
  <box
    cssClasses={bindAs(liveState$, state => (props.cssClasses ?? []).concat(classesFor(state)), (props.cssClasses ?? []).concat(['bzbus-widget', 'idle']))}
    tooltipText={bindAs(liveState$, tooltipFor, 'bzbus')}
  >
    <MaterialIcon
      icon={bindAs(liveState$, iconFor, 'construction')}
      tinted={false}
    />
    <label
      cssClasses={['bzbus-status']}
      label={bindAs(liveState$, statusText, 'idle')}
    />
  </box>
) as Gtk.Widget
