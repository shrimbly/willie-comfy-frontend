---
phase: 03-filter-sort-core-validation
plan: '10'
subsystem: moshpit-axis-overlay
tags: [moshpit, axis-overlay, pixi-viewport, html-overlay, injection-key]
dependency_graph:
  requires:
    - src/platform/moshpit/services/sortMath.ts (plan 03-03, ColumnDescriptor + RowDescriptor)
    - src/platform/moshpit/composables/useMoshpitFilteredAssets.ts (plan 03-06, columns/rows/axisMode)
    - src/platform/moshpit/components/MoshpitCanvas.vue (plan 02-xx, pixi-viewport lifecycle)
  provides:
    - src/platform/moshpit/composables/useMoshpitViewportInjection.ts (MOSHPIT_VIEWPORT_INJECTION_KEY + useMoshpitViewport)
    - src/platform/moshpit/components/MoshpitAxisOverlay.vue (HTML pill labels anchored to world-space)
  affects:
    - 03-11 (MoshpitView/MoshpitLayout mounts MoshpitAxisOverlay inside the canvas container)
tech_stack:
  added: []
  patterns:
    - shallowRef for complex third-party class instances (avoids Vue deep-reactive structural mismatch)
    - transformTick ref counter pattern (void transformTick.value) for triggering style re-evaluation on viewport 'moved' without making Viewport class reactive
    - watch with onCleanup for event listener lifecycle (vp.on/off 'moved')
    - InjectionKey<Ref<Viewport | null>> null-starts pattern (Pitfall 5)
    - global.provide in @testing-library/vue for injection key stubs
key_files:
  created:
    - src/platform/moshpit/composables/useMoshpitViewportInjection.ts
    - src/platform/moshpit/components/MoshpitAxisOverlay.vue
    - src/platform/moshpit/components/MoshpitAxisOverlay.test.ts
  modified:
    - src/platform/moshpit/components/MoshpitCanvas.vue
decisions:
  - "shallowRef<Viewport | null> used in MoshpitCanvas instead of ref<Viewport | null> — Vue's ref() deep-unwraps complex class types causing TS2345 assignment mismatch with InjectionKey<Ref<Viewport | null>>; shallowRef preserves the Viewport class type correctly"
  - 'transformTick pattern: void transformTick.value inside xLabelStyle/yLabelStyle registers reactive dependency without assigning an unused variable — avoids no-unused-vars lint errors while still tracking the dep'
  - 'watch with onCleanup handles vp.on/vp.off lifecycle cleanly — no onBeforeUnmount needed for the event listener since watch cleanup fires before the next run and on component teardown'
  - 'global.provide in @testing-library/vue render options is sufficient for injection key stubs — no wrapper component needed'
metrics:
  duration_minutes: 35
  completed_date: '2026-04-21'
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 03 Plan 10: MoshpitAxisOverlay — HTML Axis Label Overlay Summary

**One-liner:** HTML pill-label axis overlay anchored to world-space column/row coordinates via `viewport.toScreen()`, updating on every pixi-viewport `moved` event through a reactive tick counter, hidden in chaos mode and during viewport init.

## What Was Built

### Task 1: `useMoshpitViewportInjection.ts` + MoshpitCanvas.vue modification

`useMoshpitViewportInjection.ts` provides two exports:

- `MOSHPIT_VIEWPORT_INJECTION_KEY: InjectionKey<Ref<Viewport | null>>` — the symbol key for provide/inject
- `useMoshpitViewport(): Ref<Viewport | null>` — consumer helper that throws if key is missing (clear DX error)

`MoshpitCanvas.vue` modified to:

1. `shallowRef<Viewport | null>(null)` created at setup scope
2. `provide(MOSHPIT_VIEWPORT_INJECTION_KEY, viewportRef)` called synchronously in setup
3. `viewportRef.value = viewport` set after `Application.init()` resolves (inside `onMounted`)
4. `viewportRef.value = null` cleared in `onBeforeUnmount` before `app.destroy()` — consumers unsubscribe cleanly

**Key deviation:** `ref<Viewport | null>` caused TS2345 because Vue's `ref()` deep-unwraps complex class types, producing a structural type missing pixi-viewport internal properties (`_worldTransform`, `_rotation`, etc.). `shallowRef` preserves the class type exactly and is also more semantically correct for non-plain-data objects.

### Task 2: `MoshpitAxisOverlay.vue` + `MoshpitAxisOverlay.test.ts`

**MoshpitAxisOverlay.vue** — lightweight SFC:

- `v-if="axisMode !== 'chaos' && viewport"` guards render — absent until sort is active AND viewport is initialized
- X-axis `<span>` elements positioned via `:style="xLabelStyle(col)"` — CSS `left`/`top`/`transform`
- Y-axis `<span>` elements (2D only) — same pattern
- `pointer-events-none absolute inset-0 z-50` on container — pan/zoom work through the overlay
- Pill styling: `rounded-full border border-interface-stroke bg-interface-panel-surface px-3 py-1 text-xs font-medium text-base-foreground shadow-sm`

**transformTick pattern** (Pitfall 5 / 60fps safety):

```typescript
const transformTick = ref(0)

watch(
  () => viewportRef.value,
  (vp, _prevVp, onCleanup) => {
    if (!vp) return
    const handler = () => {
      transformTick.value++
    }
    vp.on('moved', handler)
    onCleanup(() => {
      vp.off('moved', handler)
    })
  },
  { immediate: true }
)

function xLabelStyle(col: ColumnDescriptor): Record<string, string> {
  void transformTick.value // registers reactive dep — style re-evals on each 'moved'
  // ...
}
```

No debounce or RAF needed: N labels × CSS left/top update is well under 1ms per frame at the 5k-asset budget (T-03-10-02 confirmed acceptable).

**formatLabel** handles:

- `timestamp` → `toLocaleDateString({ month: 'short', day: 'numeric' })` e.g. "Apr 21"
- `loras` → singular "1 LoRA" / plural "N LoRAs"
- All other params → raw value string passthrough

**truncate** caps Y-axis label at 16 chars with ellipsis (long sampler/model names).

## Note for Plan 03-11

`MoshpitAxisOverlay` must be mounted inside the canvas container element (same parent as `MoshpitCanvas`) so its `absolute inset-0` fills the same bounding box as the PixiJS canvas. The injection key is provided by `MoshpitCanvas`, so `MoshpitAxisOverlay` must be a descendant of `MoshpitCanvas` in the component tree — or a sibling whose parent provides the key.

Recommended mounting pattern in `MoshpitLayout.vue` or `MoshpitView.vue`:

```vue
<div class="relative flex-1 overflow-hidden"> <!-- canvas container -->
  <MoshpitCanvas :container-el="containerEl" />
  <MoshpitAxisOverlay />
</div>
```

Since `MoshpitCanvas` calls `provide()` synchronously in setup, it makes the key available to all descendants rendered by the same parent — including siblings rendered after it in the same slot.

## Test Coverage

`MoshpitAxisOverlay.test.ts` — 10 tests:

| Test                              | Behavior                                                           |
| --------------------------------- | ------------------------------------------------------------------ |
| chaos mode → no render            | axisMode='chaos' → overlay absent                                  |
| null viewport → no render         | viewport ref null → overlay absent                                 |
| sortX + viewport → renders        | overlay container present                                          |
| X label count matches columns     | `getAllByTestId('moshpit-axis-label-x').length === columns.length` |
| 2D mode → X and Y labels          | both label sets rendered                                           |
| 1D mode → no Y labels             | sortY null → no y labels                                           |
| timestamp label → localized date  | raw epoch → "Apr 21" format (not raw number)                       |
| loras singular → "1 LoRA"         | count=1 formats correctly                                          |
| loras plural → "3 LoRAs"          | count=3 formats correctly                                          |
| container has pointer-events-none | classList check                                                    |

Test strategy: `vi.mock` stubs `useMoshpitFilteredAssets` at module level with `ref`-backed stubs mutated per test; fake viewport provided via `global.provide` in render options with `{ on: vi.fn(), off: vi.fn(), toScreen: vi.fn().mockReturnValue({ x: 100, y: 50 }) }`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] shallowRef required instead of ref for Viewport injection key**

- **Found during:** Task 1 typecheck
- **Issue:** `ref<Viewport | null>(null)` creates a deep-reactive type that structurally mismatches `InjectionKey<Ref<Viewport | null>>` — Vue's deep unwrap strips internal pixi-viewport class properties (`_worldTransform`, `_rotation`, etc.), causing TS2345
- **Fix:** Changed to `shallowRef<Viewport | null>(null)` which preserves the class instance type exactly; also imported `shallowRef` from vue
- **Files modified:** `MoshpitCanvas.vue`
- **Commit:** `5139d24af`

**2. [Rule 1 - Bug] Dead Wrapper component in test caused TS6133 unused-variable error**

- **Found during:** Task 2 commit hook typecheck
- **Issue:** `renderWithViewport` contained a `Wrapper = defineComponent(...)` that was defined but never used — injection was correctly done via `global.provide`; `defineComponent` import also became unused
- **Fix:** Removed `Wrapper` definition and `defineComponent` import from test file
- **Files modified:** `MoshpitAxisOverlay.test.ts`
- **Commit:** `797877a98`

## Known Stubs

None — `MoshpitAxisOverlay` reads live `columns`/`rows` from `useMoshpitFilteredAssets` and live `gridSpacing` from `moshpitFilterStore`; all label positions are computed from real `viewport.toScreen()` calls.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. `paramValue` strings are interpolated via Vue text binding (auto-escaped, no `v-html`). `viewport.toScreen()` is trusted third-party math.

## Self-Check: PASSED

- [x] `src/platform/moshpit/composables/useMoshpitViewportInjection.ts` — FOUND
- [x] `src/platform/moshpit/components/MoshpitAxisOverlay.vue` — FOUND
- [x] `src/platform/moshpit/components/MoshpitAxisOverlay.test.ts` — FOUND (10 tests)
- [x] `src/platform/moshpit/components/MoshpitCanvas.vue` — FOUND (modified)
- [x] Commit `5139d24af` (Task 1 — viewport injection key) — FOUND
- [x] Commit `3b9968c62` (Task 2 — MoshpitAxisOverlay) — FOUND
- [x] Commit `797877a98` (fix — dead Wrapper removal) — FOUND
- [x] 13 tests passing (3 Canvas + 10 Overlay)
- [x] No new typecheck errors in our files
- [x] No `dark:` variants, no `:class="[]"`, no `any` / `as any`
- [x] `grep "pointer-events-none" MoshpitAxisOverlay.vue` — FOUND
- [x] `grep "on('moved'" MoshpitAxisOverlay.vue` — FOUND
- [x] `grep "off('moved'" MoshpitAxisOverlay.vue` — FOUND
- [x] `grep "useMoshpitFilteredAssets" MoshpitAxisOverlay.vue` — FOUND
- [x] `grep "useMoshpitViewport" MoshpitAxisOverlay.vue` — FOUND
- [x] `grep "MOSHPIT_VIEWPORT_INJECTION_KEY" MoshpitCanvas.vue` — 2 matches (import + provide)
- [x] `grep "provide(MOSHPIT_VIEWPORT_INJECTION_KEY" MoshpitCanvas.vue` — FOUND
- [x] `grep "viewportRef.value = viewport" MoshpitCanvas.vue` — FOUND
- [x] `grep "viewportRef.value = null" MoshpitCanvas.vue` — FOUND
