---
phase: 03-filter-sort-core-validation
plan: "06"
subsystem: moshpit/filter-store+composable
tags: [moshpit, pinia-store, composable, filter-integration, sprite-layer]
dependency_graph:
  requires:
    - src/platform/moshpit/services/filterTypes.ts (plan 03-02)
    - src/platform/moshpit/services/filterMath.ts (plan 03-02)
    - src/platform/moshpit/services/sortMath.ts (plan 03-03)
    - src/platform/moshpit/stores/moshpitMetadataStore.ts (paramsByHash — plan 03-05)
    - src/platform/moshpit/composables/useMoshpitSpriteLayer.ts (DEFAULT_CELL_SIZE — plan 02-xx)
  provides:
    - src/platform/moshpit/stores/moshpitFilterStore.ts (full store: chips, sort, grid, showHidden)
    - src/platform/moshpit/composables/useMoshpitFilteredAssets.ts (filter+sort pipeline)
    - layoutProvider option on useMoshpitSpriteLayer (additive extension)
  affects:
    - 03-07 (stub extended — MoshpitWorkflowPicker + TimeRangePicker continue working)
    - 03-08 (MoshpitFilterChipRow consumes filterStore.chips and addChip/removeChip/updateChip)
    - 03-09 (MoshpitSortControls consumes filterStore.sortX/sortY, setSortX/setSortY)
    - 03-10 (axis overlay consumes columns + rows computed refs from useMoshpitFilteredAssets)
    - 03-11 (MoshpitSettingsPanel wires layoutProvider = () => filteredAssets.entries.value)
tech_stack:
  added: []
  patterns:
    - Pinia setup-API store with OR-merge chip semantics (D-12)
    - Single computed pipeline: registry → applyFilterChips → sortMath/chaosLayout
    - Grid spacing clamped [200, 1200] in store action
    - layoutProvider as optional callback injection on SpriteLayerOptions (additive extension)
key_files:
  created:
    - src/platform/moshpit/stores/moshpitFilterStore.ts
    - src/platform/moshpit/stores/moshpitFilterStore.test.ts
    - src/platform/moshpit/composables/useMoshpitFilteredAssets.ts
    - src/platform/moshpit/composables/useMoshpitFilteredAssets.test.ts
  modified:
    - src/platform/moshpit/composables/useMoshpitSpriteLayer.ts (layoutProvider added to SpriteLayerOptions)
decisions:
  - "moshpitFilterStore extends the Wave 2 stub (Plan 03-07) — same store ID 'moshpitFilter', same workflow/timeRange/isGated shape, adds chips/sortX/sortY/gridSpacing/showHidden"
  - "D-12 OR-merge: categorical and resolution chips with same param merge values; numeric/text/boolean chips with same param fall back to append (replace-not-merge semantics)"
  - "gridSpacing clamped [200, 1200] at setGridSpacing action boundary; DEFAULT_CELL_SIZE (560) is the initial value"
  - "useMoshpitFilteredAssets calls Date.now() inline for nowMs (acceptable for production; filter tests use store-level mocking)"
  - "applyFilterChips walks paramsByHash (all known params) then intersects with registrySet (only assets currently in registry) — handles race where params arrive before registry or vice versa"
  - "Chaos seed key is 'filtered' (not activeFilterId) — layout is stable per filter composition, not tied to worker filter cycle"
  - "layoutProvider on SpriteLayerOptions is purely additive — absent in existing Phase 2 usage, so no callers need updating"
metrics:
  duration_minutes: 45
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 03 Plan 06: moshpitFilterStore + useMoshpitFilteredAssets Summary

**One-liner:** Full Pinia filter/sort store (chips, OR-merge, sort axes, grid spacing, show-hidden) wired to a single computed filter+sort pipeline (applyFilterChips → sortMath/chaos), with `layoutProvider` injected into the sprite layer for Phase 3 tween integration.

## What Was Built

### `src/platform/moshpit/stores/moshpitFilterStore.ts`

Extended the Wave 2 stub from Plan 03-07 (which only had `workflow`, `timeRange`, `isGated`, `setWorkflow`, `setTimeRange`, `reset`) with the full Phase 3 surface:

**New state refs:**
- `chips: ref<FilterChip[]>([])` — active filter chips, mutated only through actions
- `sortX: ref<ParamKey | null>(null)` — X-axis sort parameter
- `sortY: ref<ParamKey | null>(null)` — Y-axis sort parameter (2D mode)
- `gridSpacing: ref(DEFAULT_CELL_SIZE)` — world-space px between grid columns/rows
- `showHidden: ref(false)` — admits hidden-curated assets when true (FILTER-11)

**New actions:**
- `addChip(chip)` — appends or OR-merges; D-12 semantics
- `removeChip(id)` — removes by ID (FILTER-10)
- `updateChip(id, value)` — replaces chip value in-place
- `setSortX(key | null)` / `setSortY(key | null)` — set/clear sort axes
- `setGridSpacing(px)` — clamped to [200, 1200]
- `setShowHidden(value)` — toggle

**D-12 OR-merge behaviour (concrete test cases):**

| Scenario | Result |
|----------|--------|
| `addChip({param:'sampler', values:['euler']})` then `addChip({param:'sampler', values:['dpmpp_2m']})` | 1 chip with `values: ['euler', 'dpmpp_2m']` |
| `addChip({param:'sampler'})` then `addChip({param:'model'})` | 2 chips (different params, no merge) |
| `addChip({param:'cfg', kind:'categorical'})` then `addChip({param:'cfg', kind:'numeric'})` | 2 chips (incompatible kinds, no merge) |
| `addChip({id:'x'})` then `addChip({id:'x'})` | 1 chip (duplicate ID rejected) |

### `src/platform/moshpit/composables/useMoshpitFilteredAssets.ts`

Single computed pipeline: registry → filter → sort/chaos → `FilteredAssetEntry[]`.

**Public API:**

```typescript
export interface FilteredAssetEntry {
  readonly id: string
  readonly contentHash: string
  readonly thumbUrl: string | undefined
  readonly worldX: number
  readonly worldY: number
}

export function useMoshpitFilteredAssets(): {
  readonly entries: ComputedRef<readonly FilteredAssetEntry[]>
  readonly columns: ComputedRef<readonly ColumnDescriptor[]>
  readonly rows: ComputedRef<readonly RowDescriptor[]>
  readonly axisMode: ComputedRef<'chaos' | '1d' | '2d'>
}
```

**Pipeline logic (per reactive change):**

1. If `!filterStore.isGated` → return empty (FILTER-01 gate)
2. Build `hashToCuration` from `curationStore` for visible hashes
3. Call `applyFilterChips(paramsByHash, hashToCuration, chips, showHidden, timeRange, Date.now())` → filtered hashes
4. Intersect with registry hashes (handles arrival order race)
5. Branch on `axisMode`:
   - `'2d'` → `computeSortedLayout2D` → `{slots, columns, rows}`
   - `'1d'` → `computeSortedLayout1D` → `{slots, columns}`
   - `'chaos'` → `computeJitteredGrid` with seed `layoutSeedHash('filtered', sortedHashes)`

**`entries` computed** walks `registry.entries` and maps each hash to its slot's `worldX`/`worldY`. Assets not in the layout (excluded by filter or sort) are absent.

### `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` (modified)

Added optional `layoutProvider` to `SpriteLayerOptions`:

```typescript
export interface SpriteLayerOptions {
  // ...existing fields...
  readonly layoutProvider?: () => readonly GridSlot[]
}
```

`computeLayoutSlots` now checks `options.layoutProvider` first:

```typescript
function computeLayoutSlots(hashes: readonly string[]): GridSlot[] {
  if (options.layoutProvider) {
    return [...options.layoutProvider()]
  }
  // Phase 2 jittered-grid fallback
  ...
}
```

Phase 2 callers (no `layoutProvider`) are unaffected.

## Note for Plan 03-10 (Axis Overlay)

`useMoshpitFilteredAssets` exposes `columns` and `rows` as computed refs. These are the `ColumnDescriptor[]` / `RowDescriptor[]` from `sortMath` — ready for consumption by `MoshpitAxisOverlay`. Key constraint from Plan 03-03:

> `rows[r].worldY` reflects the **accumulated row-band offset**, not naïve `r × gridSpacing`. When row 0 has 3 stacked assets, `rows[1].worldY = 3 × gridSpacing`. Axis labels must use `rows[r].worldY` directly.

## Note for Plan 03-11 (MoshpitLayout.vue / MoshpitCanvas.vue)

To wire the filter pipeline into the sprite tween path, `MoshpitLayout.vue` (or `MoshpitCanvas.vue`) should:

```typescript
const filteredAssets = useMoshpitFilteredAssets()

useMoshpitSpriteLayer({
  viewport,
  ticker,
  queue,
  layoutProvider: () => filteredAssets.entries.value.map((e) => ({
    hash: e.contentHash,
    worldX: e.worldX,
    worldY: e.worldY
  }))
})
```

The `layoutProvider` is called inside `watchEffect(() => syncSprites(...))` so every reactive dep read inside `filteredAssets.entries` (filter store mutations, metadata store params, curation changes) automatically re-triggers the sprite sync + tween. No additional wiring is needed.

## Test Coverage

### moshpitFilterStore.test.ts — 24 tests

| Group | Tests |
|-------|-------|
| initial state | workflow null, timeRange preset 'all', chips empty, sortX/Y null, showHidden false, isGated false |
| setWorkflow (FILTER-01) | sets value, isGated flips true, setWorkflow(null) re-closes gate |
| addChip | appends chip, rejects duplicate ID, D-12 OR-merge categorical, no merge on different param, no merge on incompatible kind |
| removeChip (FILTER-10) | removes by ID, no-op on unknown ID |
| updateChip | replaces value, preserves id+param |
| setSortX/setSortY | accepts ParamKey, accepts null |
| setGridSpacing (SORT-04) | clamps below 200 → 200, clamps above 1200 → 1200, accepts in-range |
| setShowHidden (FILTER-11) | flips flag |
| reset | restores all fields to initial |

### useMoshpitFilteredAssets.test.ts — 14 tests

| Group | Tests |
|-------|-------|
| axisMode | 'chaos' when sortX null, '1d' when sortX set + sortY null, '2d' when both set |
| FILTER-01 gate | entries empty when no workflow, non-empty after setWorkflow |
| FILTER-11 showHidden | hidden assets excluded by default, admitted when showHidden=true |
| FILTER-08 subtractive | chip addition reduces entries |
| chaos layout | entries have finite worldX/worldY, columns empty in chaos mode |
| SORT-01 1D layout | sortX produces columns, numeric column order correct |
| SORT-03 missing param | assets lacking sortX absent from entries |
| SORT-02 2D layout | both columns and rows produced, rows empty in 1D mode |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] seedCuration helper used private store ref access**
- **Found during:** Task 2 test run
- **Issue:** Test helper `seedCuration` attempted `curationStore['curationByHash'].set(...)` which fails — Pinia stores don't expose raw refs by bracket notation
- **Fix:** Replaced with public `curationStore.load(AssetMetaRecord)` API, constructing a minimal `AssetMetaRecord` with the desired `curation` field
- **Files modified:** `useMoshpitFilteredAssets.test.ts`
- **Commit:** `b77636230`

## Known Stubs

None. All filter/sort state is fully implemented and wired. `useMoshpitFilteredAssets` returns real positions from `sortMath` or `layoutMath` — no placeholder worldX/worldY values.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. All computation is in-memory within the platform layer.

## Self-Check: PASSED

- [x] `src/platform/moshpit/stores/moshpitFilterStore.ts` — FOUND (extended stub)
- [x] `src/platform/moshpit/stores/moshpitFilterStore.test.ts` — FOUND (24 tests)
- [x] `src/platform/moshpit/composables/useMoshpitFilteredAssets.ts` — FOUND
- [x] `src/platform/moshpit/composables/useMoshpitFilteredAssets.test.ts` — FOUND (14 tests)
- [x] `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` — FOUND (layoutProvider added)
- [x] Commit `09aaf72d5` (RED: failing filter store tests) — FOUND
- [x] Commit `dd4be1bf9` (GREEN: moshpitFilterStore implementation) — FOUND
- [x] Commit `b77636230` (feat: useMoshpitFilteredAssets + layoutProvider) — FOUND
- [x] 24 moshpitFilterStore tests pass
- [x] 14 useMoshpitFilteredAssets tests pass
- [x] 272 total moshpit tests pass (18 pre-existing IDB failures in workerBridge.test.ts unchanged)
- [x] `grep "defineStore('moshpitFilter'" moshpitFilterStore.ts` — FOUND
- [x] `grep -c "it(" moshpitFilterStore.test.ts` — 24 (≥18)
- [x] `grep -c "it(" useMoshpitFilteredAssets.test.ts` — 14 (≥10)
- [x] `grep "layoutProvider" useMoshpitSpriteLayer.ts` — 3 matches (≥2)
- [x] `grep "applyFilterChips" useMoshpitFilteredAssets.ts` — FOUND
- [x] `grep -cE "computeSortedLayout1D|computeSortedLayout2D" useMoshpitFilteredAssets.ts` — 4 matches (≥2)
- [x] `grep "computeJitteredGrid" useMoshpitFilteredAssets.ts` — FOUND (chaos fallback)
- [x] No `any` / `as any` in new files
- [x] No `dark:` variants
- [x] No `:class="[]"` patterns
- [x] No pre-existing typecheck errors introduced in our files
