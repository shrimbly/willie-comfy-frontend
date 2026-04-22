---
phase: 01-workspace-shell-canvas-navigation
plan: 04
subsystem: moshpit-marquee-selection-keybindings
tags: [marquee, selection, keybindings, commands, tdd]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides:
    - useMoshpitMarquee (screen-space drag composable with modifier semantics)
    - MoshpitMarqueeOverlay (dashed rect rendered while dragging)
    - useMoshpitCommands (4 commands: FitView/ZoomToSelection/SelectAll/ClearSelection)
    - CORE_KEYBINDINGS entries F/Z/Ctrl+A/Esc scoped to moshpit-canvas-container
    - MoshpitView wired with marquee, focus-on-click, sidebar collapse
  affects:
    - src/views/MoshpitView.vue (marquee wiring, focus, sidebar collapse)
    - src/composables/useCoreCommands.ts (spread useMoshpitCommands into return)
    - src/platform/keybindings/defaults.ts (4 new moshpit-scoped keybindings)
tech_stack:
  added: []
  patterns:
    - useClickDragGuard(5) for 5px drag threshold
    - useKeyModifier for Shift/Ctrl/Meta reactive modifier state
    - document event listener add/remove pattern (add on pointerdown, remove on pointerup/cancel)
    - targetElementId DOM scoping in CORE_KEYBINDINGS
    - Spread useMoshpitCommands() into useCoreCommands return array
key_files:
  created:
    - src/platform/moshpit/composables/useMoshpitMarquee.ts
    - src/platform/moshpit/composables/useMoshpitMarquee.test.ts
    - src/platform/moshpit/components/MoshpitMarqueeOverlay.vue
    - src/composables/useMoshpitCommands.ts
    - src/composables/useMoshpitCommands.test.ts
  modified:
    - src/views/MoshpitView.vue (marquee, focus, sidebar collapse)
    - src/composables/useCoreCommands.ts (spread Moshpit commands)
    - src/platform/keybindings/defaults.ts (4 scoped keybindings)
decisions:
  - 'Marquee commits on pointerup (not pointermove) — avoids live hit-test spam in Phase 1; Phase 2 can switch to live update when hitTest has real data'
  - 'document event listeners added/removed per drag session, not via onMounted/onUnmounted — mirrors the useMarqueeSelection pattern and avoids global listener overhead when not dragging'
  - 'focus-on-click required (RESEARCH Pitfall 2) — tabindex=0 alone does not give focus on pointer interaction without explicit containerEl.value?.focus() in the pointerdown handler'
  - 'ZoomToSelection is a Phase 1 no-op with early-return guard — no bbox computation until Phase 2 supplies sprite geometries'
  - 'Moshpit commands spread into useCoreCommands return — globally registered, DOM-scoped by targetElementId; palette invocation is safe since Moshpit stores have no effect on workflow state'
metrics:
  duration: ~18m
  completed: '2026-04-20'
  tasks_completed: 3
  files_changed: 8
requirements: [NAV-02, NAV-03, NAV-04, NAV-05]
---

# Phase 01 Plan 04: Marquee Selection and Scoped Keybindings Summary

**One-liner:** Screen-space marquee composable with Shift/Ctrl/Meta modifier semantics + four DOM-scoped Moshpit keybindings (F/Z/Ctrl+A/Esc) wired into MoshpitView — NAV-02 through NAV-05 delivered as empty-canvas plumbing.

## Tasks Completed

| Task    | Name                                                          | Commit    | Files                                                             |
| ------- | ------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| 1-04-01 | Implement useMoshpitMarquee with modifier semantics + overlay | fd9e99de6 | useMoshpitMarquee.ts + .test.ts, MoshpitMarqueeOverlay.vue        |
| 1-04-02 | Create useMoshpitCommands and register scoped keybindings     | ca6f5055d | useMoshpitCommands.ts + .test.ts, defaults.ts, useCoreCommands.ts |
| 1-04-03 | Wire marquee + overlay into MoshpitView                       | 06dc63737 | MoshpitView.vue                                                   |

## Final APIs

### `useMoshpitMarquee` (`src/platform/moshpit/composables/useMoshpitMarquee.ts`)

```ts
useMoshpitMarquee(options: {
  containerEl: Ref<HTMLElement | null>
  hitTest: (rect: MarqueeRect) => readonly string[]
}): {
  isDragging: Ref<boolean>
  rect: Ref<MarqueeRect | null>
  overlayStyle: ComputedRef<CSSProperties>
  onPointerDown: (e: PointerEvent) => void
  cancel: () => void
}
```

### `useMoshpitCommands` (`src/composables/useMoshpitCommands.ts`)

Returns `ComfyCommand[]` with:

- `Moshpit.Canvas.FitView` → `requestFitView()`
- `Moshpit.Canvas.ZoomToSelection` → no-op in Phase 1 (empty selection guard)
- `Moshpit.Canvas.SelectAll` → `selectAll([])` in Phase 1
- `Moshpit.Canvas.ClearSelection` → `clear()`

### Keybindings (appended to `CORE_KEYBINDINGS`)

| Key      | Command                        | Scope                    |
| -------- | ------------------------------ | ------------------------ |
| `f`      | Moshpit.Canvas.FitView         | moshpit-canvas-container |
| `z`      | Moshpit.Canvas.ZoomToSelection | moshpit-canvas-container |
| `Ctrl+a` | Moshpit.Canvas.SelectAll       | moshpit-canvas-container |
| `Escape` | Moshpit.Canvas.ClearSelection  | moshpit-canvas-container |

## Keybinding Collision Audit

No collisions found. Research (Pattern 5) confirmed:

- `f` — only used in workflow canvas as a LiteGraph internal; not in CORE_KEYBINDINGS, scoped to graph-canvas-container
- `z` — not in CORE_KEYBINDINGS at all (Ctrl+Z is undo, handled elsewhere)
- `Ctrl+a` — exists as `Comfy.Canvas.SelectAll` scoped to `graph-canvas-container`; moshpit binding scoped to `moshpit-canvas-container` — no conflict
- `Escape` — existing `Comfy.Graph.ExitSubgraph` has no `targetElementId` (global); moshpit binding adds a scoped override. keybindingService fires the first matching binding; since the moshpit binding has a more specific DOM scope, it correctly takes priority inside `#moshpit-canvas-container`

## Focus-on-Click Required (RESEARCH Pitfall 2)

Yes, explicit `containerEl.value?.focus()` in `onContainerPointerDown` was required. `tabindex="0"` alone does not give focus on pointer interaction in Chrome — the browser only auto-focuses on keyboard events. Without the explicit call, `keybindingService` DOM containment check (`container.contains(target)`) would fail because `document.activeElement` would not be inside `#moshpit-canvas-container`.

## Marquee Rect Coordinate System

Rect values in `MarqueeRect` are **screen-space, container-local** (relative to the container element's `getBoundingClientRect()` origin). Coordinates are `e.clientX - bounds.left`, not world-space.

**Phase 2 TODO:** `hitTest` receives this screen-local rect. Phase 2 must convert to world space via `viewport.toWorld({ x: rect.left, y: rect.top })` / `viewport.toWorld({ x: rect.right, y: rect.bottom })` before testing sprite bboxes.

## Phase 2 TODOs

1. **`hitTest` implementation** — replace `() => []` in MoshpitView with a function that converts screen-rect to world-rect via `viewport.toWorld()` and returns asset IDs whose sprite bboxes intersect.
2. **`selectAll(visibleIds)`** — replace `selectAll([])` in `Moshpit.Canvas.SelectAll` with `selectAll(visibleAssetIds.value)` once the asset store is available.
3. **`ZoomToSelection` bbox computation** — replace the Phase 1 no-op with `computeBboxFromSelection(selection.selected)` → `requestZoomToSelection(bbox)` once sprite positions are tracked.

## Test Coverage

| File                         | Tests  |
| ---------------------------- | ------ |
| `useMoshpitMarquee.test.ts`  | 12     |
| `useMoshpitCommands.test.ts` | 6      |
| **Total (plan 04)**          | **18** |

All 18 tests pass. All 43 moshpit-platform tests (plans 03 + 04) pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `vi.fn()` missing type parameters for useKeyModifier mock**

- **Found during:** Task 1-04-01 (lint check)
- **Issue:** `vi.fn().mockImplementation(...)` without type parameter triggers `eslint-plugin-vitest(require-mock-type-parameters)` warning
- **Fix:** Added explicit type parameter `vi.fn<(key: string) => ReturnType<typeof ref>>()`
- **Files modified:** `src/platform/moshpit/composables/useMoshpitMarquee.test.ts`
- **Commit:** fd9e99de6

**2. [Rule 1 - Bug] Unused variable `moveEvent` in threshold test**

- **Found during:** Task 1-04-01 (typecheck)
- **Issue:** `const moveEvent = makePointerEvent(...)` was declared but never dispatched — TS6133 unused variable error
- **Fix:** Replaced with a direct `document.dispatchEvent(new PointerEvent(...))` call
- **Files modified:** `src/platform/moshpit/composables/useMoshpitMarquee.test.ts`
- **Commit:** fd9e99de6

**3. [Rule 1 - Bug] `command.label()` type error — label is `string | (() => string)`**

- **Found during:** Task 1-04-02 (typecheck)
- **Issue:** `ComfyCommand.label` is typed as `string | (() => string)` — calling `.label()` directly fails TS2722 / TS2349
- **Fix:** Added type guard in test: `typeof command.label === 'function' ? command.label() : command.label`
- **Files modified:** `src/composables/useMoshpitCommands.test.ts`
- **Commit:** ca6f5055d

## Known Stubs

- `hitTest: () => []` in MoshpitView — intentional Phase 1 stub; no assets exist yet. Phase 2 replaces with real sprite bbox intersection. Documented in Phase 2 TODOs above.
- `selectAll([])` in SelectAll command — intentional Phase 1 stub; `allIds` will be the visible asset set in Phase 2.
- `ZoomToSelection` early-return guard — intentional Phase 1 stub; Phase 2 bbox computation call is commented in the source with a `// Phase 2:` marker.

These stubs do not prevent the plan's goal (proving keybinding + marquee plumbing end-to-end) — they are intentional empty-canvas placeholders.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. T-04-01 (keybinding scope bypass via command palette) and T-04-03 (document listener leak) were mitigated per the plan threat model — listener cleanup is verified by the `cancel()` test case.

## Self-Check: PASSED

- FOUND: src/platform/moshpit/composables/useMoshpitMarquee.ts
- FOUND: src/platform/moshpit/composables/useMoshpitMarquee.test.ts
- FOUND: src/platform/moshpit/components/MoshpitMarqueeOverlay.vue
- FOUND: src/composables/useMoshpitCommands.ts
- FOUND: src/composables/useMoshpitCommands.test.ts
- FOUND commit: fd9e99de6 (Task 1-04-01 marquee + overlay)
- FOUND commit: ca6f5055d (Task 1-04-02 commands + keybindings)
- FOUND commit: 06dc63737 (Task 1-04-03 MoshpitView wiring)
- All 43 moshpit tests pass
- `pnpm typecheck` exits 0
- `oxlint` exits 0 (0 warnings, 0 errors) on all touched files
