---
phase: 04-lineage-groupings-within-cluster-sort
plan: 05
subsystem: moshpit
tags: [cluster-overlay, html-over-pixi, vue-component, tailwind-4, tdd, i18n]

requires:
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 01
    provides: ClusterNode shape (axis / bucketValue / depth / boundsWorld / children / leafHashes), OTHER_BUCKET_KEY constant
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 03
    provides: useMoshpitFilteredAssets().clusterTree (ComputedRef<ClusterNode | null>)
  - phase: 03-filter-sort-core-validation
    provides: MOSHPIT_VIEWPORT_INJECTION_KEY / useMoshpitViewport (pattern reused verbatim from deleted MoshpitAxisOverlay.vue)
provides:
  - MoshpitClusterOverlay.vue — HTML-over-Pixi bounding-box + label overlay for depth-0 and depth-1 clusters (D-06)
  - Test suite validating depth gating, (other)-bucket i18n rendering, null-viewport fallback, and viewport.toScreen reactivity via transformTick on 'moved'
  - Storybook stories (Empty / TwoAxes / WithOtherBucket) with preview-box decorators since PixiJS Viewport cannot boot in Storybook
affects: [04-06 MoshpitSettingsPanel wiring — Plan 06 mounts the overlay inside MoshpitView.vue and finishes the chrome swap]

tech-stack:
  added: []
  patterns:
    - HTML-over-Pixi overlay via Ref<Viewport | null> injection + transformTick scalar bump on 'moved' event (Phase 3 pattern reused verbatim)
    - v-for flat list projection of a recursive tree (render only depths 0 and 1) — avoids recursive template complexity while keeping the computation inside a single pure computed
    - Style-getter reactivity: `void transformTick.value` inside boxStyle registers the reactive dep so Vue re-evaluates world→screen coordinates on every pan/zoom frame
    - watch(ref, ..., { immediate: true }) with the third-arg onCleanup for viewport handler lifecycle — prevents handler leaks across Moshpit ↔ workflow canvas swaps

key-files:
  created:
    - src/platform/moshpit/components/MoshpitClusterOverlay.vue
    - src/platform/moshpit/components/MoshpitClusterOverlay.test.ts
    - src/platform/moshpit/components/MoshpitClusterOverlay.stories.ts
  modified: []

key-decisions:
  - "Flat v-for over a 2-level flattening of the tree (not a recursive component). D-06 caps rendering at depths 0 and 1, so two nested for-loops are both simpler and more ergonomic than a recursive SFC. Makes depth gating impossible to miss."
  - "Handler-cleanup via watch's onCleanup third arg (Vue 3.5 API) rather than a separate onUnmounted hook. Survives viewport ref swaps (Moshpit mount → unmount → remount) without per-case wiring."
  - "vp.off?.() optional-chain on the cleanup path. pixi-viewport extends EventEmitter so .off is always present in production; the optional chain is defensive against test fakes that omit the method and has zero runtime cost in the real path."
  - "Label truncation via Tailwind `max-w-56` (14rem ≈ 224px) rather than arbitrary `max-w-[28ch]`. Honours the project-wide ban on arbitrary percentage / length utilities where a fraction utility exists."
  - "StyleValue return type (imported as a type-only symbol from vue) — lets the style getter return either the positioned rect or `{ display: 'none' }` without an `as any` escape."

patterns-established:
  - "Component-level mock of useMoshpitFilteredAssets via vi.mock + a module-level `clusterTreeStub = ref<ClusterNode | null>` — keeps the component test hermetic from registry/meta/curation store wiring. Future overlay/readout tests can reuse this shape."
  - "Fake viewport factory with .__fireMoved() helper for pan/zoom reactivity assertions. Mirror of the MoshpitAxisOverlay test's fake; future overlays that react to 'moved' can reuse the pattern."

requirements-completed:
  - GROUP-01
  - GROUP-02

duration: ~10min
completed: 2026-04-21
---

# Phase 04 Plan 05: Cluster Overlay Component Summary

**HTML-over-Pixi cluster overlay renders bounding boxes + labels for the two outermost cluster tiers, driven by `useMoshpitFilteredAssets().clusterTree` and positioned via `viewport.toScreen` with a `transformTick` reactive bump on every pan/zoom. Ships as a standalone component ready for Plan 06 to mount into `MoshpitView.vue`.**

## Performance

- **Started:** 2026-04-21T18:04:39Z
- **Completed:** 2026-04-21T18:15Z
- **Duration:** ~10 min
- **Tasks:** 1 (TDD — RED test commit was blocked by `import-x/no-unresolved` pre-commit hook; test + component committed in a single feat commit after GREEN was verified)
- **Files created:** 3 (`.vue`, `.test.ts`, `.stories.ts`)
- **Files modified:** 0

## Task Commits

1. **Task 1 — MoshpitClusterOverlay component + tests + stories** — `083d3aafe` (feat)

## Viewport API Surface — Matches Phase 3 Exactly

The plan asked whether `.on('moved')` / `.off('moved')` matches Phase 3's usage. **Yes, verbatim.** The deleted `MoshpitAxisOverlay.vue` (retrieved from git at commit `3b9968c62`) uses:

```ts
vp.on('moved', handler)
vp.off('moved', handler)
```

This component uses the same `'moved'` event name and the same on/off signatures. No API adaptation was required. The only minor embellishment is an optional-chain on `.off?.()` to defend against test fakes that omit the method — the real pixi-viewport always provides it (extends `EventEmitter`).

## Test Mock Approach — Structural Fake Viewport

The test file defines a structural fake that satisfies only the three methods the overlay touches:

```ts
interface FakeViewport {
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  toScreen: (worldX: number, worldY: number) => { x: number; y: number }
  __handlers: Map<string, Set<(...args: unknown[]) => void>>
  __scale: number
  __fireMoved: () => void
}
```

Key design points:

- **`__scale` is mutable** — tests can change it between initial render and `__fireMoved()` to verify that the style getters re-read `toScreen` (rather than being cached by the initial computed evaluation).
- **`__handlers` is a real Map** — the mock's `.on()` stores the handler, and `__fireMoved()` walks the Map to invoke every registered handler. Lets a single test assert both subscription (via `.on.mock.calls`) and reactivity (via the scale swap → \_\_fireMoved → asserted new style).
- **`toScreen` multiplies by `__scale`** — deterministic, test-visible world→screen math. No dependency on actual pixi-viewport geometry.

The `provide` call injects a `shallowRef<FakeViewport | null>` under `MOSHPIT_VIEWPORT_INJECTION_KEY`, matching Phase 1's decision that the injection value is a `ShallowRef<Viewport | null>` (deep-reactivity over a third-party class would tip watchers over a cliff; `shallowRef` keeps the identity swap cheap while letting the overlay react to init-time null → populated).

## Cluster Count Profiling at Deep Zoom

Not profiled in-session — STATE.md carries D-18 bounds evidence from Plan 01's perf marker (5k × 3-axis cluster math in 18ms). At depth 0 + 1 only, the upper bound is `5 × 5 = 25` outer × inner per the largest likely axis cardinalities (workflow ≤5, model ≤5, prompt ≤5); realistic overlays render 5–50 absolutely-positioned `<div>`s. Zero concern on the DOM side; style recompute on `'moved'` at 60fps is ~150 reads of `vp.toScreen` per frame, well inside a budget frame.

The threat model's T-04-05-02 (cluster count explosion) accepts bounds up to 150 boxes; this is unchanged — D-06's two-level cap is what keeps it bounded, and this component faithfully implements the cap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] RED test could not be committed before GREEN**

- **Found during:** Task 1 TDD RED commit attempt (`test(04-05): add failing tests for MoshpitClusterOverlay`)
- **Issue:** Husky pre-commit runs `eslint --fix` which enforces `import-x/no-unresolved`. The RED test imports `./MoshpitClusterOverlay.vue` which didn't exist yet → `Unable to resolve path to module './MoshpitClusterOverlay.vue'` → commit blocked.
- **Fix:** Wrote the component alongside the test, verified GREEN locally (8/8 tests pass), then committed both files together as a single `feat` commit. This is the Task 2 pattern documented in Plan 04-01's SUMMARY ("Task 2 combined RED and GREEN into the single feat commit because the test file is part of the same logical unit and the RED was confirmed independently before the GREEN was written.") — same reasoning, same resolution.
- **RED independent verification:** Before writing the component, `pnpm test:unit -- --run src/platform/moshpit/components/MoshpitClusterOverlay.test.ts` failed with a module-resolution error during Vite transform, confirming the test file was not silently passing on missing imports.
- **Files affected:** Single commit `083d3aafe` contains both `.test.ts` and `.vue`.

**2. [Rule 3 — Blocking] oxlint vitest/require-mock-type-parameters warning on `vi.fn(...)` calls**

- **Found during:** Pre-commit oxlint run
- **Issue:** `vi.fn((event: string, h: ...) => { ... })` without an explicit `<Fn>` type parameter triggered the `vitest/require-mock-type-parameters` rule as warnings. Not an error, but worth cleaning up to keep lint output actionable.
- **Fix:** Added explicit `vi.fn<(event: string, h: (...args: unknown[]) => void) => void>(...)` annotations on both the `.on` and `.off` stubs in the fake viewport factory.
- **Files modified:** `src/platform/moshpit/components/MoshpitClusterOverlay.test.ts`
- **Verification:** `pnpm exec oxlint` on the three new files — 0 warnings, 0 errors.

**3. [Rule 2 — Missing critical functionality] Stories needed a visual decorator, not just an invocation harness**

- **Found during:** Task 1 story authoring — the overlay renders nothing in Storybook because the composable mock doesn't propagate cleanly to the real SFC at story render time (vi.mock is test-runtime only; Storybook uses Vite dev runtime).
- **Fix:** Stories now render two layers:
  1. A decorator div with absolutely-positioned preview boxes built directly from the story's static `clusterTree` — so designers / visual reviewers can still see the layout of the cluster tree under inspection.
  2. The actual `<MoshpitClusterOverlay />` mounted below the preview, which will render as empty (correct default for a fresh Pinia) and serves as a smoke-test that the component doesn't crash on mount.
- **Rationale:** The plan's `<action>` block says "Stories use a mock viewport via Storybook decorators since PixiJS won't initialise in SB." The composable's data path is a higher-order concern than the viewport; without at least a visual preview the stories would communicate nothing. This is a Rule 2 auto-addition.

**No architectural (Rule 4) deviations required.**

**Total deviations:** 3 auto-fixed (2 Rule 3 blocking, 1 Rule 2 story completeness).

## Threat Flags

None. No new network endpoints, no new auth paths, no new storage, no new DOM injection surfaces. Labels flow through `{{ cluster.label }}` interpolation (Vue auto-escaped); no `v-html`. The `transformTick` bump is a private scalar read via a `void` expression — no XSS or injection path. Threat T-04-05-01 mitigated (auto-escaped interpolation); T-04-05-02 mitigated (depth 0+1 cap enforced in the `renderedClusters` computed); T-04-05-03 mitigated (`watch` third-arg `onCleanup` detaches on ref change + unmount).

## Forward Readiness

- **Plan 04-06 (settings panel wiring + legacy chrome removal):** Overlay is ready to import. Plan 06 Task 2 should:
  1. Import `MoshpitClusterOverlay` in `src/views/MoshpitView.vue` (the correct mount point per Plan 04-03's Notes for Plan 06 Executor; `MoshpitCanvas.vue` was the original plan target but the mount actually belongs in `MoshpitView.vue`).
  2. Mount `<MoshpitClusterOverlay />` as a sibling of `<MoshpitCanvas />` (absolute-positioned, `pointer-events-none`, stacked above the canvas).
  3. No other wiring needed — the component pulls `clusterTree` from the composable and `viewport` from the injection key itself.
- **Plan 04-06 Task 3 i18n cleanup:** This plan did not add any new i18n keys. `moshpit.grouping.otherLabel` was already shipped by Plan 04-04 Task 1. No i18n changes needed here; Plan 06's sweep of stale `moshpit.sort.*` keys is still its own concern.

## Self-Check: PASSED

- `src/platform/moshpit/components/MoshpitClusterOverlay.vue` — FOUND
- `src/platform/moshpit/components/MoshpitClusterOverlay.test.ts` — FOUND
- `src/platform/moshpit/components/MoshpitClusterOverlay.stories.ts` — FOUND
- Commit `083d3aafe` — FOUND in git log (`git log --oneline | grep 083d3aafe`)
- 8/8 tests green via `pnpm test:unit -- --run src/platform/moshpit/components/MoshpitClusterOverlay.test.ts` (137ms run)
- `pnpm exec oxlint` on the three files — 0 warnings / 0 errors
- `pnpm typecheck` — exits 0 (full-project)
- Acceptance-criteria greps:
  - `useMoshpitViewport|MOSHPIT_VIEWPORT_INJECTION_KEY`: 2 hits ≥1 ✓
  - `useMoshpitFilteredAssets`: 2 hits ≥1 ✓ (the plan asked for 1; spec met)
  - `ClusterNode`: 3 hits ≥1 ✓
  - `OTHER_BUCKET_KEY|moshpit.grouping.otherLabel`: 3 hits ≥2 ✓
  - `transformTick`: 4 hits ≥2 ✓
  - `toScreen`: 2 hits ≥2 ✓
  - `border-(--interface-stroke)`: 1 hit ≥1 ✓
  - `text-muted-foreground`: 1 hit ≥1 ✓
  - `truncate`: 1 hit ≥1 ✓
  - Forbidden patterns (`dark:`, `:class="[`, `!important`, `as any`): 0 hits ✓
  - `moshpit-cluster-box` in test: 5 hits ≥1 ✓
  - Story file exports default meta + 3 named story exports (Empty / TwoAxes / WithOtherBucket) ✓

---

_Phase: 04-lineage-groupings-within-cluster-sort_
_Completed: 2026-04-21_
