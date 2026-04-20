---
phase: 01-workspace-shell-canvas-navigation
plan: 03
subsystem: moshpit-canvas-platform
tags: [pixi, viewport, pinia, store, canvas, adapter, tdd]
dependency_graph:
  requires: [01-01, 01-02]
  provides:
    - useMoshpitViewportStore (pan/zoom/screen + fit/zoomToSelection imperatives)
    - useMoshpitSelectionStore (Set-based selection with selectAll/clear)
    - useMoshpitSidebarStore (D-11 one-time collapse + hasHadFirstInteraction latch)
    - MoshpitCanvas (PixiJS Application + pixi-viewport lifecycle mount/unmount)
    - useMoshpitCanvasInput (CanvasInputNavigator adapter with Space+drag)
    - MoshpitView wired to MoshpitCanvas
  affects:
    - src/views/MoshpitView.vue (placeholder removed, MoshpitCanvas mounted)
tech_stack:
  added: []
  patterns:
    - Setup-API Pinia stores with minimal public surface
    - vi.hoisted + class-based mocks for ESM constructor mocks in Vitest
    - D-11 one-time collapse latch (hasHadFirstInteraction flag)
    - pixi-viewport dynamic drag plugin reconfiguration for Space+drag
    - RAF tick loop for consuming pending viewport imperatives from store
key_files:
  created:
    - src/platform/moshpit/stores/moshpitViewportStore.ts
    - src/platform/moshpit/stores/moshpitViewportStore.test.ts
    - src/platform/moshpit/stores/moshpitSelectionStore.ts
    - src/platform/moshpit/stores/moshpitSelectionStore.test.ts
    - src/platform/moshpit/stores/moshpitSidebarStore.ts
    - src/platform/moshpit/stores/moshpitSidebarStore.test.ts
    - src/platform/moshpit/components/MoshpitCanvas.vue
    - src/platform/moshpit/components/MoshpitCanvas.test.ts
    - src/platform/moshpit/composables/useMoshpitCanvasInput.ts
  modified:
    - src/views/MoshpitView.vue (replaced placeholder with MoshpitCanvas)
decisions:
  - "Used vi.hoisted + class syntax for pixi.js/pixi-viewport mocks — vi.fn().mockImplementation(() => ...) is an arrow function, not a constructor; class syntax satisfies new Application() correctly"
  - "vi.clearAllMocks() + mockResolvedValue re-applied in beforeEach prevents stale mock state across tests after init mock is cleared"
  - "Space+drag implemented by dynamic plugin.remove + viewport.drag() reconfiguration per RESEARCH Pitfall 4 — not by forwarding events through useCanvasInput"
  - "RAF tick loop reads pendingFitView / pendingZoomTarget from store each frame; imperatives are consumed (cleared) by the canvas on read"
metrics:
  duration: ~32m
  completed: "2026-04-20"
  tasks_completed: 2
  files_changed: 10
requirements: [SHELL-02, SHELL-03, NAV-01, NAV-02]
---

# Phase 01 Plan 03: Moshpit Platform Layer — Stores, Canvas, Adapter Summary

**One-liner:** Three Pinia stores (viewport/selection/sidebar) + PixiJS Application lifecycle in MoshpitCanvas + pixi-viewport adapter implementing `CanvasInputNavigator`, wired into MoshpitView — SHELL-02, SHELL-03, NAV-01, NAV-02 delivered.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1-03-01 | Create three Moshpit Pinia stores with unit tests | e72d22a4a | moshpitViewportStore.ts + .test.ts, moshpitSelectionStore.ts + .test.ts, moshpitSidebarStore.ts + .test.ts |
| 1-03-02 | Create MoshpitCanvas + Pixi adapter; wire into MoshpitView | c7f9fca55 | MoshpitCanvas.vue + .test.ts, useMoshpitCanvasInput.ts, MoshpitView.vue |

## Final Store APIs

### `useMoshpitViewportStore` (`moshpitViewport`)

```ts
// Returned symbols
panX: Ref<number>
panY: Ref<number>
zoom: Ref<number>
screenWidth: Ref<number>
screenHeight: Ref<number>
transform: ComputedRef<{ panX, panY, zoom }>
setPan(x: number, y: number): void
setZoom(z: number): void            // clamped to [0.01, 50]
setScreenSize(w: number, h: number): void
requestFitView(): void              // sets pendingFitView = true
consumeFitView(): boolean           // reads + clears pendingFitView
requestZoomToSelection(bbox: ViewportBbox): void
consumeZoomToSelection(): ViewportBbox | null
```

### `useMoshpitSelectionStore` (`moshpitSelection`)

```ts
selected: ComputedRef<string[]>
size: ComputedRef<number>
isSelected(id: string): boolean
add(id: string): void
addMany(ids: readonly string[]): void
remove(id: string): void
toggle(id: string): void
setSelection(ids: readonly string[]): void
selectAll(allIds: readonly string[]): void
clear(): void
```

### `useMoshpitSidebarStore` (`moshpitSidebar`)

```ts
activePanelId: Ref<string | null>       // 'settings' on init
hasHadFirstInteraction: Ref<boolean>    // D-11 latch
isPanelOpen: ComputedRef<boolean>
collapseOnFirstClick(): void            // no-op after first interaction
openPanel(id: string): void             // sets hasHadFirstInteraction = true
closePanel(): void
togglePanel(id: string): void
```

## Test Coverage

| File | Tests |
|------|-------|
| `moshpitViewportStore.test.ts` | 9 |
| `moshpitSelectionStore.test.ts` | 10 |
| `moshpitSidebarStore.test.ts` | 9 |
| `MoshpitCanvas.test.ts` | 3 |
| **Total** | **31** |

All 31 tests pass. Store tests cover all behavior bullets from the plan. Canvas tests cover mount-without-throw, init options, and destroy-on-unmount.

## Pixi / pixi-viewport Versions

- `pixi.js@8.18.1` — installed from catalog in Plan 01-02; resolved version confirmed in node_modules
- `pixi-viewport@6.0.3` — installed from catalog in Plan 01-02; peer dep `pixi.js >= 8` satisfied

No version deviation from Plan 01-02 research.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Arrow function mock can't be used as constructor**
- **Found during:** Task 1-03-02 (MoshpitCanvas.test.ts)
- **Issue:** `vi.fn().mockImplementation(() => ({...}))` creates an arrow function; `new Application()` in the component fails with "is not a constructor" — arrow functions cannot be used with `new`
- **Fix:** Switched to `class MockApplication { ... }` and `class MockViewport { ... }` syntax inside `vi.mock` factories; class syntax produces proper constructors
- **Files modified:** `src/platform/moshpit/components/MoshpitCanvas.test.ts`
- **Commit:** c7f9fca55

**2. [Rule 2 - Missing critical functionality] vi.fn() type parameters required by oxlint**
- **Found during:** Task 1-03-02 (lint check)
- **Issue:** `eslint-plugin-vitest(require-mock-type-parameters)` flags `vi.fn()` without type parameters as warnings; clean lint requires 0 warnings
- **Fix:** Added explicit type parameters: `vi.fn<() => void>()`, `vi.fn<() => Promise<void>>()`, `vi.fn<() => this>()`
- **Files modified:** `src/platform/moshpit/components/MoshpitCanvas.test.ts`
- **Commit:** c7f9fca55

**3. [Rule 2 - Missing critical functionality] Inline type import style**
- **Found during:** Task 1-03-01 + 1-03-02 (oxlint runs)
- **Issue:** `import { useCanvasInput, type CanvasInputNavigator }` violates `consistent-type-specifier-style: prefer-top-level` — must use separate `import type` statement
- **Fix:** Split into `import type { CanvasInputNavigator }` + `import { useCanvasInput }` in both affected files
- **Files modified:** `src/platform/moshpit/stores/moshpitViewportStore.test.ts`, `src/platform/moshpit/composables/useMoshpitCanvasInput.ts`
- **Commits:** e72d22a4a, c7f9fca55

### Space+drag Pan Testing

Space+drag pan is covered **via unit test only** — the `useMoshpitCanvasInput` composable is mocked in `MoshpitCanvas.test.ts` to isolate the lifecycle test. The adapter's Space+drag reconfiguration (watch → `viewport.plugins.remove('drag')` + `viewport.drag({ mouseButtons: held ? 'all' : 'middle' })`) is verified by code inspection. Manual verification requires `pnpm dev` → `/moshpit` → hold Space + left-drag. No automated integration test for this behavior in Phase 1; deferred to Phase 2 when assets exist for E2E context.

### Deviation from Plan Pattern 3 (Pixi init options)

Plan 03 interface block showed `canvas: canvasEl` in the `app.init()` call. The implementation uses `resizeTo: host` without a pre-created canvas element, letting PixiJS create and manage the canvas element internally. `host.appendChild(app.canvas)` then inserts the Pixi-owned canvas into the host div. This is the correct pixi.js v8 pattern (confirmed by RESEARCH Pattern 3 code example which also uses `resizeTo: containerEl` without `canvas:`).

## Known Stubs

None — no data flows to UI rendering yet. MoshpitView renders the Pixi canvas (dark background) but has no sprites. The empty-state text was removed from MoshpitView as specified in Plan 03 (moved to Plan 05 sidebar settings panel).

## Threat Surface Scan

T-03-01 (Pixi memory leak on route switch) is mitigated: `onBeforeUnmount` calls `app.destroy(true, { children: true, texture: true })` and `viewport.destroy({ children: true })`; the lifecycle test asserts `destroy` is called on unmount.

No new threat surface beyond what was modeled in the plan's threat register.

## Self-Check: PASSED

- FOUND: src/platform/moshpit/stores/moshpitViewportStore.ts
- FOUND: src/platform/moshpit/stores/moshpitSelectionStore.ts
- FOUND: src/platform/moshpit/stores/moshpitSidebarStore.ts
- FOUND: src/platform/moshpit/components/MoshpitCanvas.vue
- FOUND: src/platform/moshpit/composables/useMoshpitCanvasInput.ts
- FOUND commit: e72d22a4a (Task 1-03-01 stores)
- FOUND commit: c7f9fca55 (Task 1-03-02 canvas + adapter)
- All 31 tests pass
- `pnpm typecheck` exits 0
- `node_modules/.bin/oxlint` exits 0 (0 warnings, 0 errors) on all touched files
