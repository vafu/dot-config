import AstalNiri from 'gi://AstalNiri?version=0.1'
import { fromConnectable } from 'rxbinding'
import { map, switchMap, filter } from 'rxjs'

const niri = AstalNiri.get_default()

const workspaces = fromConnectable(niri, 'workspaces')
const focusedWs = fromConnectable(niri, 'focusedWorkspace')
const focusedWindow = fromConnectable(niri, 'focusedWindow')

console.log('=== Starting Niri Data Extraction ===\n')

// Log focused workspace info
focusedWs.subscribe(ws => {
  console.log(`\n--- Focused Workspace: ${ws.id} (idx: ${ws.idx}) ---`)
})

// Log all windows in focused workspace
focusedWs
  .pipe(
    switchMap(ws => fromConnectable(ws, 'windows')),
    filter(windows => windows.length > 0),
  )
  .subscribe(windows => {
    console.log(`\nWindows in focused workspace (${windows.length} total):`)
    windows.forEach((win, i) => {
      const layout = win.layout
      console.log(`\n  Window ${i + 1}: "${win.title}"`)
      console.log(`    App ID: ${win.app_id}`)
      console.log(`    Window ID: ${win.id}`)
      console.log(`    Is Focused: ${win.is_focused}`)
      console.log(`    Is Floating: ${win.is_floating}`)
      console.log(`    Column Index: ${layout.pos_in_scrolling_layout[0]}`)
      console.log(`    Row Index: ${layout.pos_in_scrolling_layout[1]}`)
      console.log(`    Tile Size: [${layout.tile_size[0]}, ${layout.tile_size[1]}]`)
      console.log(`    Window Size: [${layout.window_size[0]}, ${layout.window_size[1]}]`)
      console.log(`    Tile Pos in Workspace View: ${layout.tile_pos_in_workspace_view}`)
      if (layout.tile_pos_in_workspace_view) {
        console.log(`      X: ${layout.tile_pos_in_workspace_view[0]}`)
        console.log(`      Y: ${layout.tile_pos_in_workspace_view[1]}`)
      }
      console.log(`    Window Offset in Tile: [${layout.window_offset_in_tile[0]}, ${layout.window_offset_in_tile[1]}]`)
    })
  })

// Log focused window details  
focusedWindow.subscribe(win => {
  if (!win) {
    console.log('\n>>> No focused window')
    return
  }
  
  const layout = win.layout
  console.log(`\n>>> FOCUSED WINDOW: "${win.title}"`)
  console.log(`    Column: ${layout.pos_in_scrolling_layout[0]}`)
  console.log(`    Tile Pos in Workspace View: ${layout.tile_pos_in_workspace_view}`)
  console.log(`    Tile Pos type: ${typeof layout.tile_pos_in_workspace_view}`)
  console.log(`    Tile Pos is null: ${layout.tile_pos_in_workspace_view === null}`)
  console.log(`    Tile Pos length: ${layout.tile_pos_in_workspace_view?.length}`)
  if (layout.tile_pos_in_workspace_view) {
    console.log(`      X: ${layout.tile_pos_in_workspace_view[0]}`)
    console.log(`      Y: ${layout.tile_pos_in_workspace_view[1]}`)
  } else {
    console.log(`    >>> tile_pos_in_workspace_view is NULL - this is the problem!`)
  }
})

console.log('\nWatching for changes... (focus different windows to see data)\n')

// Initial trigger
setTimeout(() => {
  console.log('Triggering initial check...')
  const ws = niri.get_focused_workspace()
  if (ws) {
    console.log(`Current workspace: ${ws.id}`)
    const windows = ws.get_windows()
    console.log(`Windows count: ${windows.length}`)
  }
}, 100)
