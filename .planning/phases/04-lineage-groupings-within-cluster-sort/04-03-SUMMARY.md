---
phase: 04-lineage-groupings-within-cluster-sort
plan: 03
subsystem: moshpit
tags: [filter-pipeline, pinia, composable, cluster-layout, save-node, exhaustive-switch, tdd]

requires:
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 01
    provides: computeClusterLayout / computeNestingOrder / ClusterNode / GroupingAxis / WithinClusterSortMode / compareAssetsForWithinCluster
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 02
    provides: NormalizedParams.saveNodeIdentity live on the schema + in IDB (v2→v3 migration)
provides:
  - ParamKey widened with 'saveNode'; PRIMARY_FILTER_PARAMS + ADVANCED_FILTER_PARAMS tier constants (D-13 / D-14)
  - Exhaustive `never` defaults in filterMath.ts categorical + numeric switches (Pitfall 1 guard)
  - moshpitFilterStore flipped: sortX / sortY / setSortX / setSortY removed; activeGroupings / withinClusterSort / isAdvancedOpen + toggleGrouping / setWithinClusterSort / toggleAdvanced / setAdvancedOpen added
  - useMoshpitFilteredAssets returns { entries, clusterTree, activeGroupingOrder }; consumes computeClusterLayout + computeNestingOrder; flat sprite-layer slot contract unchanged
  - MoshpitSortControls.vue + MoshpitAxisOverlay.vue (and .test.ts siblings) deleted; mounts/imports stripped from MoshpitSettingsPanel.vue + src/views/MoshpitView.vue
  - Pre-existing TS2367 in useMinimap.test.ts resolved (blocker for hook-gated commits on this branch)
affects: [04-04 moshpitFilterStore saveNode axis wiring, 04-05 cluster overlay (reads clusterTree), 04-06 grouping toggle UI (reads activeGroupings + withinClusterSort + PRIMARY_FILTER_PARAMS / ADVANCED_FILTER_PARAMS)]

tech-stack:
  added: []
  patterns:
    - Exhaustive `never` defaults (`const _exhaustive: never = param`) on every `switch (param: ParamKey)` in filterMath.ts — any future ParamKey widening surfaces as a compile error instead of silently defaulting to undefined (Pitfall 1)
    - Tier-const exports (PRIMARY_FILTER_PARAMS / ADVANCED_FILTER_PARAMS) co-located with the ParamKey union so Plan 04-06 can route chip choices without store churn
    - Two-output Pinia reactive layout composable (Pattern 2 from RESEARCH): `entries` preserves the flat sprite-layer contract while `clusterTree` surfaces the hierarchical tree for overlay consumption — same source of truth, single computation

key-files:
  created: []
  modified:
    - src/platform/moshpit/services/filterTypes.ts  (Task 1 — ParamKey + PRIMARY/ADVANCED consts)
    - src/platform/moshpit/services/filterMath.ts  (Task 1 — saveNode categorical case + exhaustive never defaults)
    - src/platform/moshpit/services/filterMath.test.ts  (Task 1 — 5 new saveNode tests)
    - src/platform/moshpit/stores/moshpitFilterStore.ts  (Task 2 — full surface flip)
    - src/platform/moshpit/stores/moshpitFilterStore.test.ts  (Task 2 — dropped 6 sort-axis blocks, added 11 grouping/within-sort/advanced-open blocks)
    - src/platform/moshpit/composables/useMoshpitFilteredAssets.ts  (Task 3 — computeClusterLayout + computeNestingOrder wiring; LayoutResult + return shape)
    - src/platform/moshpit/composables/useMoshpitFilteredAssets.test.ts  (Task 3 — rewritten around clusterTree + activeGroupingOrder)
    - src/platform/moshpit/components/MoshpitSettingsPanel.vue  (Task 4 — MoshpitSortControls import + mount removed)
    - src/platform/moshpit/components/MoshpitSettingsPanel.test.ts  (Task 4 — 2 sort-controls blocks + stub removed)
    - src/views/MoshpitView.vue  (Task 4 — MoshpitAxisOverlay import + mount removed)
    - src/platform/moshpit/components/MoshpitGridSpacingControl.vue  (Task 4 deviation — isDisabled flipped from filterStore.sortX===null to !filterStore.isGated)
    - src/platform/moshpit/components/MoshpitGridSpacingControl.test.ts  (Task 4 deviation — test names + fixture adjusted)
    - src/renderer/extensions/minimap/composables/useMinimap.test.ts  (Task 4 deviation — cast call[0] to string to clear TS2367 blocker)
  deleted:
    - src/platform/moshpit/components/MoshpitSortControls.vue  (Task 4)
    - src/platform/moshpit/components/MoshpitSortControls.test.ts  (Task 4)
    - src/platform/moshpit/components/MoshpitAxisOverlay.vue  (Task 4)
    - src/platform/moshpit/components/MoshpitAxisOverlay.test.ts  (Task 4)

key-decisions:
  - "Emit `{ entries, clusterTree, activeGroupingOrder }` from useMoshpitFilteredAssets — preserves the flat sprite-layer contract (existing callers unchanged) while exposing the tree for Plan 05's cluster overlay and the auto-nest order for debug/a11y"
  - "MoshpitGridSpacingControl's disabled predicate switches from the removed `filterStore.sortX === null` check to `!filterStore.isGated` — same UX (disabled when canvas has nothing to lay out), re-expressed in terms of the gate Plan 03 actually exposes"
  - "Fix pre-existing TS2367 in useMinimap.test.ts inline (narrow `call[0] as string` cast) — the husky pre-commit `pnpm typecheck` step blocks every commit on this branch until it's resolved, regardless of what files the staged diff touches. Tracked in deferred-items.md from Phase 04-01; fixed here as a Rule 3 blocker"
  - "Store surface is tier-agnostic — routing chips into primary vs advanced lives in Plan 04-06's popover UI, not in the store. The store exposes `isAdvancedOpen` + `setAdvancedOpen` for controlled Reka Collapsible binding and nothing more"

patterns-established:
  - "Exhaustive never guard on ParamKey switches in filterMath.ts (Pitfall 1). Every future ParamKey widening must add a case to `getCategoricalParamValue` AND `getNumericParamValue` — compile errors surface the miss"
  - "Tier-const arrays (PRIMARY_FILTER_PARAMS / ADVANCED_FILTER_PARAMS) are the single source of truth for chip-picker routing. Plan 04-06's popover reads these directly"
  - "Two-output layout composable: single `layout` computed does the work; two downstream computeds (`entries`, `clusterTree`) slice the result. Avoids double-computing buckets while exposing both views Plan 05 needs"

requirements-completed:
  - GROUP-01
  - GROUP-09
  - GROUP-10
  - CSORT-01
  - FILTER-12

duration: ~75 min (across two agent sessions; Tasks 1–3 previously, Task 4 + SUMMARY this session)
completed: 2026-04-21
---

# Phase 04 Plan 03: Filter-Pipeline Wiring Summary

**Flipped moshpit's reactive filter/layout pipeline onto the cluster-math substrate: ParamKey widened with `saveNode`, store surface swapped to grouping + within-cluster sort, `useMoshpitFilteredAssets` now consumes `computeClusterLayout`, and the legacy sort-axis UI is gone — full-project typecheck green.**

## Performance

- **Started:** 2026-04-21 (prior session — Tasks 1–3)
- **Completed:** 2026-04-21 (Task 4 + SUMMARY)
- **Tasks:** 4 (1 widening + exhaustiveness, 2 store flip, 3 composable wire, 4 legacy delete)
- **Files modified:** 10 (net — 4 deleted, 13 touched)

## Accomplishments

### Task 1 — ParamKey widen + exhaustiveness audit + tier consts (commit `80d924bb2`)

- `filterTypes.ts`: added `'saveNode'` to `ParamKey` union; exported `PRIMARY_FILTER_PARAMS` (5 entries: positivePrompt, saveNode, model, favourite, tags) and `ADVANCED_FILTER_PARAMS` (8 entries: cfg, steps, seed, sampler, scheduler, resolution, loras, negativePrompt)
- `filterMath.ts`: added `case 'saveNode': return params.saveNodeIdentity ?? undefined` to `getCategoricalParamValue`; replaced the `default:` fall-through in both categorical and numeric switches with `const _exhaustive: never = param` guards
- `filterMath.test.ts`: new saveNode assertions — chip matches on `saveNodeIdentity === 'Final Output'`, multi-value OR semantics, null-identity exclusion

### Task 2 — moshpitFilterStore flip (commit `624a5c0bc`)

- Removed `sortX` / `sortY` refs + `setSortX` / `setSortY` mutators entirely
- Added `activeGroupings: readonly GroupingAxis[]` (insertion-ordered), `withinClusterSort: WithinClusterSortMode` (default `'newestFirst'`), `isAdvancedOpen: boolean` (default `false`)
- Added `toggleGrouping(axis)`, `setWithinClusterSort(mode)`, `toggleAdvanced()`, `setAdvancedOpen(open)` mutators
- `reset()` clears all three new fields to their defaults alongside the existing reset payload
- Store tests: dropped the 6 sort-axis blocks; added 11 new blocks covering toggleGrouping insertion-order, setWithinClusterSort + default, toggleAdvanced / setAdvancedOpen, reset coverage, and saveNode chip routing (store is tier-agnostic)

### Task 3 — useMoshpitFilteredAssets on computeClusterLayout (commit `5570b089a`)

- Dropped `computeSortedLayout1D/2D`, `computeJitteredGrid`, `layoutSeedHash`, `ColumnDescriptor`, `RowDescriptor` imports; brought in `computeClusterLayout`, `computeNestingOrder`, `ClusterNode`, `GroupingAxis`
- New `LayoutResult`: `{ visible, slotByHash, clusterTree }`. Single `layout` computed runs `applyFilterChips → computeNestingOrder → computeClusterLayout`; sibling computeds slice it into `entries` and `clusterTree`
- Return shape now `{ entries: ComputedRef<readonly FilteredAssetEntry[]>, clusterTree: ComputedRef<ClusterNode | null>, activeGroupingOrder: ComputedRef<readonly GroupingAxis[]> }`
- `FilteredAssetEntry { id, contentHash, thumbUrl, worldX, worldY }` shape is preserved — `useMoshpitSpriteLayer` continues to render from the flat slot list
- `filenameByHash` built from registry entries via a narrow `(e as { filename?: string | null }).filename ?? null` access, defensive against future registry shape churn
- Composable tests rewritten around clusterTree + activeGroupingOrder (not-gated → empty / null; gated + empty groupings → flat grid via clusterLayout's single-leaf path; one-axis / two-axis grouping with leaf-sum + auto-nest checks; within-cluster sort swap without cluster-structure change)

### Task 4 — delete legacy sort UI + incidental compile fixes (commit `327797c88`)

- Deleted `MoshpitSortControls.vue`, `MoshpitSortControls.test.ts`, `MoshpitAxisOverlay.vue`, `MoshpitAxisOverlay.test.ts`
- `MoshpitSettingsPanel.vue`: removed `import MoshpitSortControls` + `<MoshpitSortControls v-if="filterStore.isGated" class="mt-4" />` mount
- `MoshpitSettingsPanel.test.ts`: stripped the `MoshpitSortControls` stub entry and the two blocks asserting its hidden/shown behaviour
- `src/views/MoshpitView.vue`: removed `import MoshpitAxisOverlay` + `<MoshpitAxisOverlay />` mount
- `grep -rn "MoshpitSortControls\|MoshpitAxisOverlay" src/` returns 0 hits

## Task Commits

1. **Task 1 — ParamKey widen + exhaustive filterMath switches** — `80d924bb2` (feat)
2. **Task 2 — moshpitFilterStore flip to grouping + within-cluster sort** — `624a5c0bc` (refactor)
3. **Task 3 — useMoshpitFilteredAssets onto computeClusterLayout** — `5570b089a` (refactor)
4. **Task 4 — delete legacy sort controls + axis overlay** — `327797c88` (refactor)

## Final Exported Signatures

### `moshpitFilterStore.ts`

```ts
export const useMoshpitFilterStore = defineStore('moshpitFilter', () => {
  // retained
  const workflow: Ref<string | null>
  const timeRange: Ref<TimeRange>
  const chips: Ref<FilterChip[]>
  const gridSpacing: Ref<number>
  const showHidden: Ref<boolean>
  const isGated: ComputedRef<boolean>
  // new (Plan 04-03 Task 2)
  const activeGroupings: Ref<readonly GroupingAxis[]>
  const withinClusterSort: Ref<WithinClusterSortMode>
  const isAdvancedOpen: Ref<boolean>
  function toggleGrouping(axis: GroupingAxis): void
  function setWithinClusterSort(mode: WithinClusterSortMode): void
  function toggleAdvanced(): void
  function setAdvancedOpen(open: boolean): void
  // removed: sortX, sortY, setSortX, setSortY
})
```

### `useMoshpitFilteredAssets.ts`

```ts
export function useMoshpitFilteredAssets(): {
  readonly entries: ComputedRef<readonly FilteredAssetEntry[]>
  readonly clusterTree: ComputedRef<ClusterNode | null>
  readonly activeGroupingOrder: ComputedRef<readonly GroupingAxis[]>
}

interface FilteredAssetEntry {
  readonly id: string
  readonly contentHash: string
  readonly thumbUrl: string | null
  readonly worldX: number
  readonly worldY: number
}
```

### `filterTypes.ts`

```ts
export type ParamKey =
  | 'model'
  | 'loras'
  | 'cfg'
  | 'steps'
  | 'sampler'
  | 'scheduler'
  | 'seed'
  | 'positivePrompt'
  | 'negativePrompt'
  | 'width'
  | 'height'
  | 'timestamp'
  | 'favourite'
  | 'tags'
  | 'resolution'
  | 'saveNode' // NEW

export const PRIMARY_FILTER_PARAMS: readonly ParamKey[] = [
  'positivePrompt',
  'saveNode',
  'model',
  'favourite',
  'tags'
]
export const ADVANCED_FILTER_PARAMS: readonly ParamKey[] = [
  'cfg',
  'steps',
  'seed',
  'sampler',
  'scheduler',
  'resolution',
  'loras',
  'negativePrompt'
]
```

## Test Evidence

All Moshpit behavioural tests green: `441 / 441` passing across 36 test files. One perf-budget flake in `clusterLayout.test.ts` (115 ms vs 100 ms budget) reproducible only under concurrent CPU load during the full Moshpit suite run; the test passes cleanly in isolation (141 ms total for the whole file). This perf marker is owned by Plan 04-01 and is unrelated to Plan 04-03's refactors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Flipped `MoshpitGridSpacingControl.isDisabled` from `filterStore.sortX === null` to `!filterStore.isGated`**

- **Found during:** Task 4 (MoshpitSortControls deletion surfaced a second consumer of the removed `sortX` ref)
- **Issue:** Plan 03's `<files_modified>` frontmatter lists 13 files but does not include `MoshpitGridSpacingControl.vue` or its test. The control held a `filterStore.sortX === null` check that no longer compiles once Task 2 drops `sortX` from the store surface.
- **Fix:** Flipped `isDisabled` to `!filterStore.isGated` — preserves the UX (grid-spacing slider disabled when the canvas has nothing to lay out) in terms of the gate Plan 03 actually exposes. Updated both test names and the fixture from `setSortX('cfg')` to `setWorkflow('fp-abc')`.
- **Files modified:** `src/platform/moshpit/components/MoshpitGridSpacingControl.vue`, `src/platform/moshpit/components/MoshpitGridSpacingControl.test.ts`
- **Verification:** `pnpm test:unit -- --run src/platform/moshpit/components/MoshpitGridSpacingControl.test.ts` — 2 / 2 green. Full Moshpit suite — 441 / 441.
- **Committed in:** `327797c88` (Task 4)

**2. [Rule 3 - Blocking] Resolved pre-existing TS2367 in `useMinimap.test.ts`**

- **Found during:** Task 4 commit — husky pre-commit `pnpm typecheck` step blocks the commit on this error
- **Issue:** `vi.mocked(window.addEventListener).mock.calls.find((call) => call[0] === 'resize')` — TS narrows `call[0]` to `keyof DedicatedWorkerGlobalScopeEventMap` (the dev-worker event map takes precedence in type inference here), which has no overlap with the literal `'resize'` for window events. This error existed on HEAD before Phase 04 started (tracked in `deferred-items.md` since Plan 04-01) and blocks every hook-gated commit on this branch regardless of which files the staged diff touches.
- **Fix:** Narrow cast `(call[0] as string) === 'resize'` so the comparison is against a plain string, matching the runtime semantics (resize events do fire on window). No behavioural change.
- **Files modified:** `src/renderer/extensions/minimap/composables/useMinimap.test.ts`
- **Verification:** `pnpm typecheck` exits 0 (only time this branch's typecheck has been clean since Phase 04 began). `pnpm test:unit -- --run src/renderer/extensions/minimap/composables/useMinimap.test.ts` — 35 / 35 green.
- **Committed in:** `327797c88` (Task 4)

**Scope note:** Deviation 2 is the file-path out-of-scope case the scope-boundary rule nominally defers to `deferred-items.md`. It is included here because (a) the error materially blocks every downstream Phase 04 commit under the current husky config, (b) the CLAUDE.md rule forbids `--no-verify`, (c) prior plans (04-01 + 04-02) attributed commit landing to "lint-staged only reverts the index" — behaviour that no longer holds on this branch. Fixing it now unblocks Plans 04-04/05/06 without further friction. `deferred-items.md` updated accordingly.

---

**Total deviations:** 2 auto-fixed (2 Rule 3 Blocking).
**Impact on plan:** Both fixes were strict prerequisites for Task 4's typecheck-green commit.

## Notes for Plan 06 Executor

Plan 04-03's Task 4 already performed the file deletions Plan 06 Task 3 was scoped to do. Plan 06 Task 3 should be retargeted to the remaining follow-on cleanups:

- Remove stale `moshpit.sort.*` i18n keys from `src/locales/en/main.json`
- knip cleanup of any now-unused exports in `filterTypes.ts` / `sortMath.ts`
- Portable existence guards (`[ ! -f … ]`) to verify the deletions still hold

Plan 06 Task 2 as written targets `MoshpitCanvas.vue` for the axis→cluster overlay mount swap. The actual mount lived in `src/views/MoshpitView.vue` and was removed by Plan 04-03 Task 4. Plan 06 Task 2 should be retargeted to add `<MoshpitClusterOverlay />` to `src/views/MoshpitView.vue` (or wherever Plan 05 determines the cluster overlay belongs) instead of `MoshpitCanvas.vue`.

## Issues Encountered

- **Husky pre-commit `pnpm typecheck` hook is now blocking (not advisory).** Plan 04-01 and 04-02 SUMMARIES claimed commits landed despite the hook because "lint-staged only reverts the index, not the already-created commit." That is no longer true — the working tree revert is full and the commit does not land. Deviation 2 above resolves the underlying pre-existing error so future Phase 04 commits are unblocked.
- **clusterLayout.test.ts perf marker is flaky under concurrent CPU load.** 115 ms observed during full-suite run vs 100 ms budget; the file passes in isolation at ~140 ms total for 13 tests. Owned by Plan 04-01; not a Plan 04-03 regression.

## Next Plan Readiness

- **Plan 04-04 (moshpitFilterStore saveNode axis wiring):** store + filterMath already handle the `saveNode` categorical axis; any axis-wiring work Plan 04-04 needs is likely in the popover UI, not the store.
- **Plan 04-05 (cluster overlay):** `useMoshpitFilteredAssets` now exposes `clusterTree` + `activeGroupingOrder` — the overlay can walk the tree directly and read the nesting order for labels without touching the store.
- **Plan 04-06 (grouping toggle UI + chip tier popover):** `PRIMARY_FILTER_PARAMS` / `ADVANCED_FILTER_PARAMS` are ready to import; `toggleGrouping` / `setWithinClusterSort` / `setAdvancedOpen` are ready to bind. The MoshpitSettingsPanel has an empty space where `<MoshpitSortControls>` used to live — Plan 06 Task 1 fills it.

## Self-Check: PASSED

- Task 1 commit `80d924bb2` — FOUND in git log
- Task 2 commit `624a5c0bc` — FOUND in git log
- Task 3 commit `5570b089a` — FOUND in git log
- Task 4 commit `327797c88` — FOUND in git log
- `src/platform/moshpit/components/MoshpitSortControls.vue` — MISSING (expected, deleted)
- `src/platform/moshpit/components/MoshpitSortControls.test.ts` — MISSING (expected, deleted)
- `src/platform/moshpit/components/MoshpitAxisOverlay.vue` — MISSING (expected, deleted)
- `src/platform/moshpit/components/MoshpitAxisOverlay.test.ts` — MISSING (expected, deleted)
- `grep -rn "MoshpitSortControls\|MoshpitAxisOverlay" src/` — 0 hits
- `pnpm typecheck` — exits 0
- Moshpit unit suite — 441 / 441 behavioural tests green (1 flaky perf marker owned by 04-01)

---

_Phase: 04-lineage-groupings-within-cluster-sort_
_Completed: 2026-04-21_
