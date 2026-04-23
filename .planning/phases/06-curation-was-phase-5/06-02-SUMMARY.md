---
phase: 06-curation-was-phase-5
plan: 02
subsystem: moshpit/filter-pipeline
tags: [filter, curation, folders, paramkey, tdd]
dependency_graph:
  requires:
    - 06-01 (moshpitCurationStore.hydrate + moshpitFoldersStore)
  provides:
    - folder as first-class ParamKey in PRIMARY_FILTER_PARAMS
    - filterMath folder branch (OR-within-chip via curation.folders)
    - useMoshpitParamValueOptions folder case (folder id counts)
    - MoshpitLayout boot hydration for curation + folders stores
  affects:
    - src/platform/moshpit/services/filterTypes.ts
    - src/platform/moshpit/services/filterMath.ts
    - src/platform/moshpit/services/filterMath.test.ts
    - src/platform/moshpit/composables/useMoshpitParamValueOptions.ts
    - src/platform/moshpit/composables/useMoshpitParamValueOptions.test.ts
    - src/views/layouts/MoshpitLayout.vue
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN — RED commit (341cd1ccc) before GREEN commit (91da9e330)
    - Exhaustiveness guards extended with 'folder' in both getCategoricalParamValue and getNumericParamValue switches
    - Fire-and-forget hydrate pattern (no await, independent .catch) mirroring overrideStore.hydrate
key_files:
  created: []
  modified:
    - src/platform/moshpit/services/filterTypes.ts (ParamKey + PRIMARY_FILTER_PARAMS)
    - src/platform/moshpit/services/filterMath.ts (folder branch + exhaustiveness)
    - src/platform/moshpit/services/filterMath.test.ts (5 new folder tests)
    - src/platform/moshpit/composables/useMoshpitParamValueOptions.ts (folder case)
    - src/platform/moshpit/composables/useMoshpitParamValueOptions.test.ts (2 new folder tests)
    - src/views/layouts/MoshpitLayout.vue (curation + folders hydration)
decisions:
  - "'folder' appended to PRIMARY_FILTER_PARAMS (after 'tags') — surfaces in chip popover primary section"
  - 'paramValueOptions folder case returns folder ids as value (not names) — UI resolves names via foldersStore.orderedFolders'
  - 'MoshpitLayout hydration order: override → curation → folders — independent stores, no ordering constraint'
  - "Exhaustiveness: 'folder' added to both getCategoricalParamValue and getNumericParamValue switch cases to preserve never-guard compile safety"
metrics:
  duration: ~15 min
  completed_date: '2026-04-23T19:13:00Z'
  tasks_completed: 2
  files_created: 0
  files_modified: 6
  tests_added: 7
---

# Phase 6 Plan 02: Folder Filter Integration Summary

Wire `'folder'` as a first-class `ParamKey` into the filter pipeline, add `matchesCategoricalChip` folder branch, enumerate folder ids in `useMoshpitParamValueOptions`, and hydrate curation + folders stores on `MoshpitLayout` mount.

## Tasks Completed

| Task      | Name                                              | Commit    | Files              |
| --------- | ------------------------------------------------- | --------- | ------------------ |
| 1 (RED)   | Failing folder filter tests                       | 341cd1ccc | filterMath.test.ts |
| 1 (GREEN) | folder ParamKey + filterMath + paramValueOptions  | 91da9e330 | 4 files            |
| 2         | Hydrate curation + folders on MoshpitLayout mount | 878e70060 | 1 file             |

## What Was Built

### ParamKey / PRIMARY_FILTER_PARAMS additions

`'folder'` appended to the `ParamKey` union in `filterTypes.ts` and added to `PRIMARY_FILTER_PARAMS` (after `'tags'`). `ADVANCED_FILTER_PARAMS` is unchanged — folders are a primary-surface concern.

### filterMath folder branch

In `matchesCategoricalChip`, a dedicated `if (param === 'folder')` branch was inserted before the generic `getCategoricalParamValue` path:

```ts
if (param === 'folder') {
  return val.values.some((folderId) => curation.folders.includes(folderId))
}
```

OR-within-chip semantics (D-12): any matching folder id in `chip.values` causes a match. The predicate reads from `CurationRecord.folders[]` — assets with no folder curation silently fail the chip (FILTER-09 missing-param semantics).

### Exhaustiveness notes

Both `getCategoricalParamValue` and `getNumericParamValue` had `case 'folder': return undefined` added to their exhaustive switches. These cases are dead paths at runtime (the explicit `param === 'folder'` branch above fires first), but listing them is required to satisfy the `_exhaustive: never` guard that turns future `ParamKey` additions into compile errors (T-04-03-01).

### paramValueOptions semantic note

`useMoshpitParamValueOptions` for `paramSource === 'folder'` returns `ValueOption[]` where `value` is the **folder id** (a UUID), not the folder name. The count is the number of assets (`contentHash` entries in `paramsByHash`) whose `CurationRecord.folders[]` contains that id.

The UI (Plan 05) is responsible for mapping folder ids to human-readable names via `moshpitFoldersStore.orderedFolders`. This separation keeps the counting logic decoupled from the display layer.

### MoshpitLayout hydration order

`onMounted` now calls hydrate in this order:

1. `overrideStore.hydrate()` — pre-existing
2. `curationStore.hydrate()` — new (Plan 02)
3. `foldersStore.hydrate()` — new (Plan 02)

All three are fire-and-forget (no `await`), each with an independent `.catch(console.warn)`. The splash loader is removed before any hydration call — hydration failures are non-fatal. The three stores are independent (no shared IDB transaction); ordering has no semantic consequence.

## Test Coverage

| File                                | Tests added                                         |
| ----------------------------------- | --------------------------------------------------- |
| filterMath.test.ts                  | 5 (folder filter describe block + integration test) |
| useMoshpitParamValueOptions.test.ts | 2 (folder id counts + empty foldersStore)           |
| **Total**                           | **7**                                               |

All 816 moshpit unit tests green post-implementation. `pnpm typecheck` clean.

## Deviations from Plan

None — plan executed exactly as written. All `must_haves.truths`, `artifacts`, and `key_links` satisfied.

TDD protocol followed: RED commit `341cd1ccc` (failing tests with `'folder'` not yet in `ParamKey` → typecheck errors surfaced in pre-commit hook but commit landed), GREEN commit `91da9e330` (all 83 target tests pass, typecheck clean).

## Known Stubs

None. `useMoshpitParamValueOptions` folder case is fully wired to live `curationStore.get(hash).folders` data. MoshpitLayout hydrates both stores on mount.

## Self-Check: PASSED

- FOUND: `| 'folder'` in src/platform/moshpit/services/filterTypes.ts (line 28)
- FOUND: `'folder'` in PRIMARY_FILTER_PARAMS in src/platform/moshpit/services/filterTypes.ts (line 43)
- FOUND: `param === 'folder'` in src/platform/moshpit/services/filterMath.ts (line 151)
- FOUND: `case 'folder'` in getCategoricalParamValue in src/platform/moshpit/services/filterMath.ts (line 240)
- FOUND: `case 'folder'` in getNumericParamValue in src/platform/moshpit/services/filterMath.ts (line 285)
- FOUND: `case 'folder'` in src/platform/moshpit/composables/useMoshpitParamValueOptions.ts (line 72)
- FOUND: commit 341cd1ccc (RED tests)
- FOUND: commit 91da9e330 (GREEN implementation)
- FOUND: commit 878e70060 (Task 2 MoshpitLayout)
- FOUND: `useMoshpitCurationStore` in src/views/layouts/MoshpitLayout.vue
- FOUND: `useMoshpitFoldersStore` in src/views/layouts/MoshpitLayout.vue
- FOUND: `curationStore.hydrate` in src/views/layouts/MoshpitLayout.vue
- FOUND: `foldersStore.hydrate` in src/views/layouts/MoshpitLayout.vue
