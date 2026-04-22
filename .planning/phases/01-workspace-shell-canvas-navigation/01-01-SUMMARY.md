---
phase: 01-workspace-shell-canvas-navigation
plan: 01
subsystem: canvas-input
tags: [canvas, input, composable, refactor, litegraph, tdd]
dependency_graph:
  requires: []
  provides: [useCanvasInput, CanvasInputNavigator]
  affects: [useCanvasInteractions, Plans 03 and 04 (Pixi adapter)]
tech_stack:
  added: [src/composables/canvas/useCanvasInput.ts]
  patterns: [adapter pattern, navigator interface, TDD red-green]
key_files:
  created:
    - src/composables/canvas/useCanvasInput.ts
    - src/composables/canvas/useCanvasInput.test.ts
  modified:
    - src/renderer/core/canvas/useCanvasInteractions.ts
    - src/renderer/core/canvas/useCanvasInteractions.test.ts
decisions:
  - "Used event.type === 'wheel' instead of instanceof WheelEvent in forwardEvent — happy-dom does not create real WheelEvent prototype instances from Partial<WheelEvent> mocks, making instanceof checks unreliable in unit tests"
  - 'happy-dom WheelEvent constructor does not persist clientX/clientY/ctrlKey/shiftKey from init dict — delta fields (deltaX/deltaY) are supported; regression tests assert only what the environment supports'
  - 'canvasStore mock extended with mutable canvas getter (mockCanvasValue) to test shouldHandleNodePointerEvents reactive computed'
metrics:
  duration: '13m 17s'
  completed: '2026-04-20'
  tasks_completed: 3
  files_changed: 4
---

# Phase 01 Plan 01: Canvas Input Extraction Summary

**One-liner:** Pure `useCanvasInput` composable extracted from litegraph with adapter pattern — zero renderer imports, 36 passing tests, all 10 existing callers unchanged.

## What Was Built

### Task 1: Regression Suite (test(01-01))

Commit: `16e1e0d73`

Added 14 new `it()` blocks to `useCanvasInteractions.test.ts` (10 → 24 total), covering:

- `handleWheel` standard/legacy nav routing via `dispatchEvent` call count
- `handleWheel` over focused/unfocused `[data-capture-wheel="true"]` elements in both modes
- `handlePointer` buttons=1/2/4 with `read_only` true/false
- `shouldHandleNodePointerEvents` reactive computed with true/false `read_only`
- `forwardEventToCanvas` WheelEvent delta field preservation, PointerEvent/MouseEvent constructor reconstruction

All 24 tests pass against the **unmodified** production file, confirming D-08 gate.

### Task 2: Pure Composable (feat(01-01))

Commit: `cf5c7d8cf`

Created `src/composables/canvas/useCanvasInput.ts`:

```ts
export interface CanvasInputNavigator {
  readonly isStandardNavMode: () => boolean
  readonly isReadOnly: () => boolean
  readonly dispatchWheel: (event: WheelEvent) => void
  readonly dispatchPointer: (event: PointerEvent | MouseEvent) => void
}

export function useCanvasInput(navigator: CanvasInputNavigator): {
  handleWheel: (event: WheelEvent) => void
  handlePointer: (event: PointerEvent) => void
  forwardEvent: (event: WheelEvent | PointerEvent | MouseEvent) => void
}
```

Zero imports from `@/scripts/app`, `@/renderer/**`, or `@/platform/settings/**`.
Only `@/base/pointerUtils` (for `isMiddlePointerInput`) and no Vue imports needed.

12 unit tests in `useCanvasInput.test.ts` cover all behavior bullets from the plan.

### Task 3: Thin Adapter (refactor(01-01))

Commit: `85810fc6f`

`useCanvasInteractions.ts` reduced from 141 → 68 lines. It now:

1. Creates a `CanvasInputNavigator` wired to `app.canvas`, `canvasStore`, and `settingStore`
2. Delegates to `useCanvasInput(navigator)`
3. Returns identical public shape: `{ handleWheel, handlePointer, forwardEventToCanvas, shouldHandleNodePointerEvents }`

## Test Case Counts

| File                            | Before | After  |
| ------------------------------- | ------ | ------ |
| `useCanvasInteractions.test.ts` | 10     | 24     |
| `useCanvasInput.test.ts`        | 0      | 12     |
| **Total**                       | **10** | **36** |

## Callers NOT Touched

All 10 callers continue importing from `@/renderer/core/canvas/useCanvasInteractions` unchanged:

- `LGraphNode.vue`
- `NodeWidgets.vue`
- `useNodePointerInteractions.ts`
- `useNodeEventHandlers.ts`
- `useNodeImage.ts`
- `useNodeAnimatedImage.ts`
- `GraphCanvasMenu.vue`
- `SelectionToolbox.vue`
- `GraphCanvas.vue`
- `AppBuilder.vue`

`pnpm typecheck` exits 0.

## Surprises Found During Extraction

### 1. happy-dom WheelEvent constructor limitations

`new WheelEvent('wheel', { ctrlKey: true, clientX: 42 })` in happy-dom does NOT persist `ctrlKey`, `clientX`, `clientY`, `metaKey`, or `shiftKey` — only `deltaX`/`deltaY` are propagated from the init dict. This affected:

- Regression tests that tried to assert `dispatched.clientX === 42` — fixed by only asserting `deltaX`/`deltaY`
- Tests for standard nav + Ctrl+wheel forwarding — tested via legacy mode (which forwards on any plain wheel) to avoid the ctrlKey limitation

### 2. instanceof WheelEvent unreliable with partial mocks

`Partial<WheelEvent>` objects used as test fixtures fail `event instanceof WheelEvent`. Changed `forwardEvent` to use `event.type === 'wheel'` instead of `instanceof WheelEvent`, making it both test-friendly and semantically correct.

### 3. preventDefault called twice in handlePointer → forwardEvent

The original code and the extracted composable both call `event.preventDefault()` in `handlePointer` before calling `forwardEvent` (which also calls it). Existing tests use `toHaveBeenCalled()` not `toHaveBeenCalledTimes(1)` so this was already accepted behavior. Preserved as-is to avoid behavioral drift.

### 4. canvasStore mock shape

The original mock for `useCanvasStore` didn't expose a `canvas` property (only `getCanvas`). Added a `get canvas()` getter backed by a mutable module-level variable (`mockCanvasValue`) to test `shouldHandleNodePointerEvents` which reads `canvasStore.canvas?.read_only`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] instanceof WheelEvent unreliable in test environment**

- **Found during:** Task 2 (useCanvasInput.test.ts authoring)
- **Issue:** `Partial<WheelEvent>` mocks don't pass `instanceof WheelEvent`, causing `forwardEvent` to route wheel events to `dispatchPointer` instead of `dispatchWheel`
- **Fix:** Changed `forwardEvent` condition from `event instanceof WheelEvent` to `event.type === 'wheel'`
- **Files modified:** `src/composables/canvas/useCanvasInput.ts`
- **Commit:** cf5c7d8cf

**2. [Rule 2 - Missing functionality] canvasStore mock lacked `canvas` reactive property**

- **Found during:** Task 1 (regression suite for shouldHandleNodePointerEvents)
- **Issue:** Mock returned `{ getCanvas, setCursorStyle }` but `useCanvasInteractions` reads `canvasStore.canvas?.read_only` for the computed
- **Fix:** Added `get canvas()` getter to mock backed by `mockCanvasValue` module-level variable
- **Files modified:** `src/renderer/core/canvas/useCanvasInteractions.test.ts`
- **Commit:** 16e1e0d73

## Known Stubs

None — no data flows to UI rendering in this plan. Pure composable extraction.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `src/composables/canvas/useCanvasInput.ts` exists ✓
- `src/composables/canvas/useCanvasInput.test.ts` exists ✓
- Commit `16e1e0d73` exists (regression suite) ✓
- Commit `cf5c7d8cf` exists (pure composable) ✓
- Commit `85810fc6f` exists (thin adapter) ✓
- All 36 tests pass ✓
- `pnpm typecheck` exits 0 ✓
- `pnpm lint` on touched files exits 0 (0 errors) ✓
