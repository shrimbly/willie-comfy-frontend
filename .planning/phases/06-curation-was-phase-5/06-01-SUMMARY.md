---
phase: 06-curation-was-phase-5
plan: 01
subsystem: moshpit/curation-data-layer
tags: [indexeddb, pinia, repositories, curation, folders]
dependency_graph:
  requires: []
  provides:
    - MoshpitDB v5 with folders store
    - curationRepository (saveCuration, saveManyCurations, loadAllCurations)
    - foldersRepository (loadAllFolders, saveFolder, deleteFolder, clearAllFolders)
    - moshpitCurationStore mutation API
    - moshpitFoldersStore
  affects:
    - src/platform/moshpit/services/thumbRepository.types.ts
    - src/platform/moshpit/services/thumbRepository.ts
    - src/platform/moshpit/services/thumbRepository.test.ts
    - src/platform/moshpit/services/curationRepository.ts
    - src/platform/moshpit/services/curationRepository.test.ts
    - src/platform/moshpit/services/foldersRepository.ts
    - src/platform/moshpit/services/foldersRepository.test.ts
    - src/platform/moshpit/stores/moshpitCurationStore.ts
    - src/platform/moshpit/stores/moshpitCurationStore.test.ts
    - src/platform/moshpit/stores/moshpitFoldersStore.ts
    - src/platform/moshpit/stores/moshpitFoldersStore.test.ts
tech_stack:
  added:
    - curationRepository (new) — IDB read-modify-write for assetMeta.curation
    - foldersRepository (new) — IDB CRUD for the v5 folders store
    - moshpitFoldersStore (new) — Pinia store for folder management
  patterns:
    - Debounced per-hash persist (100ms) via schedulePersist, mirroring moshpitOverrideStore
    - Bulk flush via single IDB readwrite transaction (saveManyCurations) — avoids write amplification
    - Map swap on every mutation for Pinia reactivity (new Map(curationByHash.value))
    - isValidFolderRecord type guard on read (mirrors overrideRepository pattern)
key_files:
  created:
    - src/platform/moshpit/services/curationRepository.ts
    - src/platform/moshpit/services/curationRepository.test.ts
    - src/platform/moshpit/services/foldersRepository.ts
    - src/platform/moshpit/services/foldersRepository.test.ts
    - src/platform/moshpit/stores/moshpitFoldersStore.ts
    - src/platform/moshpit/stores/moshpitFoldersStore.test.ts
  modified:
    - src/platform/moshpit/services/thumbRepository.types.ts (FolderRecord, MoshpitDB.folders, MOSHPIT_DB_VERSION=5)
    - src/platform/moshpit/services/thumbRepository.ts (v4→v5 upgrade hook)
    - src/platform/moshpit/services/thumbRepository.test.ts (v4→v5 migration tests)
    - src/platform/moshpit/stores/moshpitCurationStore.ts (mutation API + debounced persist)
    - src/platform/moshpit/stores/moshpitCurationStore.test.ts (mutations describe block)
decisions:
  - MOSHPIT_DB_VERSION bumped to 5; v4→v5 migration adds `folders` store with idempotency guard (if !objectStoreNames.contains)
  - curationRepository uses read-modify-write on assetMeta (ASSET-04 invariant preserved — curation nested in assetMeta, not separate store)
  - Caps enforced at mutation time per threat model T-06-01-02/03 — tag length 64, tag count 50/asset, folder count 200
  - removeTag/removeFromFolder on unknown hash are no-ops (skipIfMissing guard in applyUpdate)
  - moshpitFoldersStore.remove() scrubs dangling folder ids BEFORE deleting FolderRecord (T-06-01-06 / Pitfall 4)
  - applyManyOptimistic cancels pending per-hash timers before bulk flush to prevent double-write
metrics:
  duration: ~10 min (both tasks already implemented, tested, committed)
  completed_date: '2026-04-23T07:06:39Z'
  tasks_completed: 2
  files_created: 6
  files_modified: 5
  tests_added: 57
---

# Phase 6 Plan 01: MoshpitDB v5 + Curation Data Layer Summary

IndexedDB v5 migration, curationRepository + foldersRepository mirroring overrideRepository shape, moshpitCurationStore mutation actions with debounced persist, and new moshpitFoldersStore with referential-integrity scrub on folder removal.

## Tasks Completed

| Task | Name                                                               | Commit    | Files   |
| ---- | ------------------------------------------------------------------ | --------- | ------- |
| 1    | Extend MoshpitDB to v5 + curationRepository + foldersRepository    | 731a180d2 | 8 files |
| 2    | Extend moshpitCurationStore mutations + create moshpitFoldersStore | 418bb313c | 4 files |

## What Was Built

### MOSHPIT_DB_VERSION = 5

The `folders` object store was added in the v4→v5 upgrade hook with an idempotency guard (`if (!db.objectStoreNames.contains('folders'))`). No per-record migration needed — pre-v5 data universally has `CurationRecord.folders: []`. The upgrade is non-destructive: existing `assetMeta` and `overrides` records are preserved unmodified.

### Caps Enforced (Threat Model T-06-01-02/03)

- **Tag length**: 64 chars post-trim. Tags exceeding this limit are silently rejected.
- **Tag count**: 50 per asset. Adding a 51st tag is a no-op.
- **Folder count**: 200 total. `create()` returns `''` on cap hit so Plan 03 orchestrator can show a toast.

### curationRepository

- `saveCuration(hash, curation)` — read-modify-write on `assetMeta`; silent no-op if hash has no record (ASSET-04 invariant).
- `saveManyCurations(updates)` — single `readwrite` transaction on `assetMeta` for bulk flush (avoids IDB write amplification, Pitfall 2).
- `loadAllCurations()` — builds `Map<hash, CurationRecord>` from all assetMeta records.

### foldersRepository

Mirrors `overrideRepository.ts` exactly: `isValidFolderRecord` type guard skips malformed records with `console.warn`; `loadAllFolders`, `saveFolder`, `deleteFolder`, `clearAllFolders`.

### moshpitCurationStore Mutations

All six single-hash mutation actions added: `setFavourite`, `addTag`, `removeTag`, `setHidden`, `addToFolder`, `removeFromFolder`. Plus `applyManyOptimistic` (bulk) and `hydrate`. Every mutation uses the `new Map(curationByHash.value)` swap pattern for Pinia reactivity.

Debounced persist: 100ms debounce per hash via `schedulePersist`. `applyManyOptimistic` cancels pending timers for affected hashes before calling `saveManyCurations` to avoid double-writes.

### moshpitFoldersStore

New Pinia store: `folders` ref (Map), `orderedFolders` computed (sorted by `createdAt`), `create`/`rename`/`remove`/`createFromSelection`/`hydrate`/`clearAll`. The `remove` action iterates `curationStore.curationByHash` and calls `removeFromFolder` for every hash that references the deleted folder id — before the folder is deleted from IDB (Pitfall 4 / T-06-01-06).

## Test Files

| File                         | Tests                                     |
| ---------------------------- | ----------------------------------------- |
| thumbRepository.test.ts      | 19 (includes 3 new v4→v5 migration tests) |
| curationRepository.test.ts   | 6                                         |
| foldersRepository.test.ts    | 6                                         |
| moshpitCurationStore.test.ts | 17                                        |
| moshpitFoldersStore.test.ts  | 9                                         |
| **Total**                    | **57**                                    |

All 57 tests green. `pnpm typecheck` clean.

## Deviations from Plan

None — plan executed exactly as written. All `must_haves.truths`, `artifacts`, and `key_links` satisfied.

The only observation: Task 1 was already committed before plan execution began (commit `731a180d2`). Task 2 files were implemented but unstaged; this executor committed them as `418bb313c`.

## Pointers for Downstream Plans

- **Plan 02 (filter integration)**: `moshpitCurationStore.curationByHash` is now a reactive `ref(Map<hash, CurationRecord>)`. Filter predicates for `favourite`, `hidden`, `tags`, and `folders` can watch this map directly. The `get(hash)` accessor is the lightweight read path.
- **Plan 03 (orchestrator)**: Consumes `moshpitCurationStore` mutation actions (keybindings `S`/`T`/`H`) and `moshpitFoldersStore.create`/`createFromSelection`. Folder count cap returns `''` — orchestrator should check for empty string and show a toast. Same for tag cap (no-op silently — orchestrator may want to show feedback if it knows the cap was hit).
- **Plan 05 (UI)**: `moshpitFoldersStore.orderedFolders` is a computed array sorted by `createdAt`. The curation panel can render this directly. `createFromSelection` is the primary affordance for "Add selection to folder".

## Self-Check: PASSED

- FOUND: src/platform/moshpit/services/curationRepository.ts
- FOUND: src/platform/moshpit/services/foldersRepository.ts
- FOUND: src/platform/moshpit/stores/moshpitFoldersStore.ts
- FOUND: src/platform/moshpit/stores/moshpitFoldersStore.test.ts
- FOUND: commit 731a180d2 (Task 1)
- FOUND: commit 418bb313c (Task 2)
