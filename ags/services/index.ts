import Brightness from './brightness'
import { MonitorService, WindowService, WorkspaceService } from './wm/types'

const WM_BACKEND = 'locus' as 'niri' | 'locus'

export interface Services {
  workspace: WorkspaceService
  window: WindowService
  brightness: Brightness
  monitor: MonitorService
}

export default async function obtainWmService<S extends keyof Services>(
  type: S,
): Promise<Services[S]> {
  switch (type) {
    case 'window':
      return (await getWindowService()) as Services[S]
    case 'workspace':
      return (await getWorkspaceService()) as Services[S]
    case 'brightness':
      return Brightness.get_default() as Services[S]
    case 'monitor':
      return (await getMonitorService()) as Services[S]
  }
}

async function isHypr() {
  const lib = await import('gi://AstalHyprland?version=0.1')
  const hypr = lib.AstalHyprland.get_default()
  return hypr != null && hypr.monitors != null && hypr.monitors.length != 0
}

async function isNiri() {
  const lib = await import('gi://AstalNiri?version=0.1')
  const niri = lib.AstalNiri.get_default()
  return niri != null && niri.outputs != null && niri.outputs.length != 0
}

async function getMonitorService() {
  // if (await isHypr()) {
  //   const { hyprMonitorService } = await import('./wm/hypr')
  //   return hyprMonitorService
  // }
  // if (await isNiri()) {
  if (WM_BACKEND === 'locus') {
    const { locusMonitorService } = await import('./wm/locus/monitors')
    return locusMonitorService
  } else {
    const { niriMonitorService } = await import('./wm/niri/monitors')
    return niriMonitorService
  }
  // }
  throw Error('Unsupported WM!')
}

async function getWorkspaceService() {
  // if (await isHypr()) {
  //   const { hyprMonitorService } = await import('./wm/hypr')
  //   return hyprMonitorService
  // }
  // if (await isNiri()) {
  if (WM_BACKEND === 'locus') {
    const { locusWorkspaceService } = await import('./wm/locus/workspace')
    return locusWorkspaceService
  } else {
    const { workspaceService } = await import('./wm/niri/workspace')
    return workspaceService
  }
  // }
  throw Error('Unsupported WM!')
}

async function getWindowService() {
  // if (await isHypr()) {
  //   const { hyprMonitorService } = await import('./wm/hypr')
  //   return hyprMonitorService
  // }
  // if (await isNiri()) {
  if (WM_BACKEND === 'locus') {
    const { locusWindowService } = await import('./wm/locus/window')
    return locusWindowService
  } else {
    const { windowService } = await import('./wm/niri/window')
    return windowService
  }
  // }
  throw Error('Unsupported WM!')
}
