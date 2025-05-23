import Brightness from './brightness'
import { windowService, workspaceService } from './wm/hypr'
import { WindowService, WorkspaceService } from './wm/types'

export interface Services {
  workspace: WorkspaceService
  window: WindowService
  brightness: Brightness
}

export default function obtainService<S extends keyof Services>(
  type: S
): Services[S] {
  switch (type) {
    case 'window':
      return windowService as Services[S]
    case 'workspace':
      return workspaceService as Services[S]
    case 'brightness':
      return Brightness.get_default() as Services[S]
  }
}
