import Brightness from './brightness'
import { monitorService, windowService, workspaceService } from './wm/hypr'
import { MonitorService, WindowService, WorkspaceService } from './wm/types'

export interface Services {
  workspace: WorkspaceService
  window: WindowService
  brightness: Brightness
  monitor: MonitorService
}

export default function obtainWmService<S extends keyof Services>(
  type: S
): Services[S] {
  switch (type) {
    case 'window':
      return windowService as Services[S]
    case 'workspace':
      return workspaceService as Services[S]
    case 'brightness':
      return Brightness.get_default() as Services[S]
    case 'monitor':
      return monitorService as Services[S]
  }
}
