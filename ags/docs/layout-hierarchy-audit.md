# Layout Hierarchy Audit

Generated from the per-widget subagent layout pass.

## Best cleanup targets

1. `widgets/ws-indicator/ws.tsx`
   - Replace `Gtk.ListView + NoSelection + Gio.ListStore + SignalListItemFactory` with a simple vertical `Gtk.Box` of dot widgets. This indicator is tiny and static enough that the model/factory stack is overbuilt.

2. `widgets/bar/window_indicators.tsx`
   - The `frame overlay -> surface box -> content box` stack looks heavier than necessary. The `surface` one-child box can likely be removed by applying tile/frame classes to one root overlay.

3. `widgets/bar/locus.tsx`
   - `WorkspacesWidget` has an outer one-child box that mostly forwards visibility/alignment. Those props can likely move to the list itself. The old legacy project wrapper had the same issue.

4. `widgets/bar/ws_matrix.tsx`
   - One-child overlay with no active overlay behavior. Return the carousel directly if this widget is revived.

5. `widgets/bar/workspace_strip.tsx`
   - Nested overlays can probably collapse: tint revealer could be added to the inner overlay instead of wrapping another overlay.

6. `widgets/agent-approvals/overlay.tsx`
   - Detail wrapper boxes around diff/command/text are one-child boxes where `spacing` has no effect. Move the styling class to the actual `GtkSource.View` / `Gtk.TextView`.

7. `widgets/bar_dropdown/index.tsx`
   - Header row plus spacer box exists just to right-align the suspend button. The button can likely live directly in the vertical box with `halign=END`.

8. `widgets/bar/panel-widgets.tsx`
   - `barblock-badge-layer` has no SCSS selectors. The overlay is needed, but that class is dead.

9. `widgets/adw.tsx`
   - `ActionRow`, `ListBox`, `ExpanderRow`, and `CarouselIndicatorDots` are mostly redundant. `ListBox` is also suspicious because it assumes flattened children while one call site passed a binding.

10. `widgets/index.ts`
    - `ToggleButton` alias is unused. `SearchEntry` alias was used once and added little value.

## Medium-risk targets

- `widgets/bar/panel-widgets.tsx`: `button-subgroup-main` wrapper could probably be removed by moving `button-subgroup-main` and `opened` onto the primary child, but CSS needs visual verification.
- `widgets/bar/bt_status.tsx`: Bluetooth battery indicator has an inner wrapper mostly carrying tooltip/alignment. Those can likely move to the menu button/indicator.
- `widgets/osd/OSD.tsx`: OSD uses both window visibility and revealer reveal state. Keep the revealer only if the crossfade is intentional; otherwise it is redundant. Also check window padding plus inner margin in `style/osd.scss`.

## Likely keep

- `Gtk.CenterBox` in `widgets/bar/index.tsx`: justified for true centered layout.
- `button-subgroup` in `widgets/bar/panel-widgets.tsx`: keeps one continuous background/radius layer for secondary children.
- `Badged` overlay in `widgets/bar/panel-widgets.tsx`: overlay behavior is real even if one CSS class is dead.
- `MaterialIcon` and `LevelIndicator`: both are justified custom widgets, not wrapper noise.

## Cleanup status

Removed as unused in the follow-up cleanup:

- `widgets/adw.tsx`
- `widgets/bar/workspaces.tsx`
- `widgets/bar/workspace_strip.tsx`
- `widgets/bar/ws_matrix.tsx`
- `widgets/bar/windowtitle.tsx`
- `widgets/bar/pomodoro.tsx`
- `widgets/ws-indicator/`
- `widgets/bar_dropdown/`
- `style/workspaces.scss`
- `style/bar_dropdown.scss`
- stale SCSS for the old project chip, workspace strip, window title, workspace carousel, side workspace overlay, and pomodoro widget
- unused live-module exports: `AgentWidgets`, `AudioRouteSelector`, `MutedIndicator`, `DndIndicator`, `LocusProjectWidget`, `LocusProjectChip`, `LocusContextChip`, `SimpleProjectChip`

Active layout simplifications completed in the worker pass:

- `widgets/bar/locus.tsx`: removed the one-child `WorkspacesWidget` wrapper and moved visibility/alignment/classes onto the workspace list.
- `widgets/osd/OSD.tsx` and `style/osd.scss`: kept the revealer for crossfade, renamed the inner visual shell to `osd-shell`, and removed duplicate outer window padding.
- `widgets/bar/panel-widgets.tsx`: removed the `button-subgroup-main` wrapper by moving its class/opened state to the primary child, and removed the dead `barblock-badge-layer` class.
- `widgets/rsynapse/list.tsx`: removed the redundant scrolled-window wrapper and put list visibility/classes/alignment directly on the list view.
- `widgets/bar/window_indicators.tsx` and `style/bar.scss`: removed the one-child surface box and applied frame/tile classes to the root overlay while preserving badge overlays.
- `widgets/bar/bt_status.tsx`: removed the extra Bluetooth battery indicator wrapper and moved the device tooltip to the menu button.
- `widgets/agent-approvals/overlay.tsx` and `style/agent-approvals.scss`: removed single-child detail wrapper boxes and moved detail styling onto the actual text/source views.
