import AstalNiri from 'gi://AstalNiri?version=0.1'
import Brightness from './brightness'
import { MonitorService, WindowService, WorkspaceService } from './wm/types'
import AstalHyprland from 'gi://AstalHyprland?version=0.1'

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
      throw Error()
    case 'workspace':
      // return workspaceService as Services[S]
      throw Error()
    case 'brightness':
      return Brightness.get_default() as Services[S]
    case 'monitor':
      return (await getMonitorService()) as Services[S]
  }
}

async function isHypr() {
  const hypr = AstalHyprland.get_default()
  return hypr != null && hypr.monitors != null && hypr.monitors.length != 0
}

async function isNiri() {
  const niri = AstalNiri.get_default()
  console.log('niri:', niri.outputs)
  return niri != null && niri.outputs != null && niri.outputs.length != 0
}

async function getMonitorService() {
  // if (await isHypr()) {
  //   const { hyprMonitorService } = await import('./wm/hypr')
  //   return hyprMonitorService
  // }
  // if (await isNiri()) {
    const { niriMonitorService } = await import('./wm/niri/monitors')
    return niriMonitorService
  // }
  throw Error('Unsupported WM!')
}
