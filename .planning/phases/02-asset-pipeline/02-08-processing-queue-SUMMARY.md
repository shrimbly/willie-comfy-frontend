---
phase: 02-asset-pipeline
plan: '08'
subsystem: moshpit/composables
tags: [composable, queue, pinia, wave-3, tdd]
dependency_graph:
  requires: [02-04, 02-06, 02-07]
  provides:
    [
      useMoshpitProcessingQueue,
      useMoshpitAssetRegistry,
      ProcessingQueueState,
      three-pinia-stores
    ]
  affects: [02-11-sprite-layer, 02-10-settings-panel]
tech_stack:
  added: []
  patterns:
    [injectable-bridge, storeToRefs-for-map-reactivity, fake-worker-pattern]
key_files:
  created:
    - src/platform/moshpit/composables/useMoshpitProcessingQueue.ts
    - src/platform/moshpit/composables/useMoshpitAssetRegistry.ts
    - src/platform/moshpit/stores/moshpitThumbStore.ts
    - src/platform/moshpit/stores/moshpitThumbStore.test.ts
    - src/platform/moshpit/stores/moshpitMetadataStore.ts
    - src/platform/moshpit/stores/moshpitMetadataStore.test.ts
    - src/platform/moshpit/stores/moshpitCurationStore.ts
    - src/platform/moshpit/stores/moshpitCurationStore.test.ts
  modified:
    - src/platform/moshpit/services/workerMessages.ts (added assetId to EnqueueAssetInput + ThumbReadyMessage)
    - src/platform/moshpit/services/thumbWorker.ts (echo assetId in thumbReady postMessage)
    - src/platform/moshpit/services/thumbWorker.test.ts (add assetId to baseInput fixture)
    - src/platform/moshpit/services/workerBridge.test.ts (add assetId to enqueue + thumbReady fixtures)
    - src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts (Wave-0 RED → GREEN + OSS-path integration test)
decisions:
  - 'storeToRefs() required to recover Ref<Map> from Pinia auto-unwrapping — metaStore.assetIdToHash.value would be undefined without it'
  - 'EnqueueAssetInput and ThumbReadyMessage extended with assetId field (touches plan 05/06 files); existing tests updated to include assetId'
  - 'Three Pinia stores created in this plan (plan 07 parallel dep) — will be replaced by plan 07 outputs after merge'
metrics:
  duration: ~25min
  completed: 2026-04-21
  tasks_completed: 1
  files_created: 9
  files_modified: 5
---

# Phase 02 Plan 08: Processing Queue Composable — Summary

**One-liner:** Queue composable integrating IDB warm-cache diff, injectable WorkerBridge, and OSS-path asset.id→contentHash bridging via metaStore; asset registry composable resolves cloud and local-backend hashes reactively.

## Tasks Completed

| Task | Name                                                         | Commit    | Tests |
| ---- | ------------------------------------------------------------ | --------- | ----- |
| 1    | useMoshpitProcessingQueue + useMoshpitAssetRegistry + stores | e559cbc53 | 14/14 |

## What Was Built

### `useMoshpitProcessingQueue`

- Accepts an injectable `WorkerBridge` (real or fake) for testability
- `computeQueueDelta(filtered, cachedHashes)` — pure exported function, OSS-path null hashes always included
- `setFilter(filterKey, assets)` — diffs against IDB warm cache, enqueues only the delta; skips bridge entirely when cache is warm (ASSET-10 / D-08)
- `onThumbReady` handler: calls `thumbStore.addThumb`, `metaStore.setMetadata`, `metaStore.recordAssetHash(assetId, contentHash)` (OSS bridge), `curationStore.load`, increments `done`
- `cancel()` sets `total = done` so `isActive` flips false while keeping completed thumbs in IDB (D-06)
- `onBeforeUnmount` auto-tears down bridge and callbacks
- `ProcessingQueueState` exported as named type for Plan 11 consumption (prevents duplicate bridge instantiation)

### `useMoshpitAssetRegistry`

- Single reactive `entries: ComputedRef<readonly AssetEntry[]>` for PixiJS canvas
- Resolves `a.asset_hash ?? metaStore.getHashForAssetId(a.id)` — both cloud and OSS paths work
- Uses `storeToRefs(metaStore)` to recover the `Ref<Map>` Pinia auto-unwraps; without this `.value` on the Map is `undefined` and the computed never re-runs on `recordAssetHash` mutations

### Three Pinia Stores (Plan 07 parallel dep)

Created as a parallel dependency since plan 07 runs concurrently:

- `moshpitThumbStore` — `Map<hash, objectURL>` with revoke-on-replace and reset
- `moshpitMetadataStore` — `Map<hash, meta>` + `excludedCount` + `assetIdToHash` OSS bridge map
- `moshpitCurationStore` — Phase-2 scaffold: `Map<hash, CurationRecord>` load/get/reset

### `workerMessages.ts` / `thumbWorker.ts` Extensions

`EnqueueAssetInput` gained `assetId: string` and `ThumbReadyMessage` gained `assetId: string`. The worker echoes the field back through `processAsset` → `postMessage`. Existing tests in `thumbWorker.test.ts` and `workerBridge.test.ts` updated with the new required field.

## Test Coverage

| File                              | Tests                            | Status          |
| --------------------------------- | -------------------------------- | --------------- |
| useMoshpitProcessingQueue.test.ts | 4 (3 Wave-0 + 1 OSS integration) | All GREEN       |
| moshpitThumbStore.test.ts         | 3                                | All GREEN       |
| moshpitMetadataStore.test.ts      | 4                                | All GREEN       |
| moshpitCurationStore.test.ts      | 3                                | All GREEN       |
| **Total**                         | **14**                           | **14/14 GREEN** |

All Wave-0 `computeQueueDelta` cases turn GREEN. OSS-path integration test (non-skipped) verifies end-to-end reactivity: `setFilter` → `fireThumbReady` → `metaStore.getHashForAssetId` returns hash → `useMoshpitAssetRegistry().entries.value` contains the entry.

No `it.skip` — all tests fully implemented.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 05/06 EnqueueAssetInput and ThumbReadyMessage lacked assetId**

- **Found during:** Task 1 — composable calls `bridge.enqueue({ ..., assetId: view.id })` but the type had no `assetId` field
- **Fix:** Added `readonly assetId: string` to `EnqueueAssetInput` and `ThumbReadyMessage` in `workerMessages.ts`; echoed the field through `thumbWorker.ts processAsset`; updated three test fixtures (`thumbWorker.test.ts`, `workerBridge.test.ts`)
- **Files modified:** `workerMessages.ts`, `thumbWorker.ts`, `thumbWorker.test.ts`, `workerBridge.test.ts`
- **Commit:** e559cbc53

**2. [Rule 2 - Missing] Three Pinia stores (plan 07 parallel dep) not present in worktree**

- **Found during:** Task 1 — imports `@/platform/moshpit/stores/moshpit{Thumb,Metadata,Curation}Store` which plan 07 creates concurrently
- **Fix:** Created all three stores + their test files inline (exact interface contract from plan 07 PLAN.md)
- **Files created:** `moshpitThumbStore.ts/.test.ts`, `moshpitMetadataStore.ts/.test.ts`, `moshpitCurationStore.ts/.test.ts`
- **Commit:** e559cbc53

**3. [Rule 1 - Bug] Pinia auto-unwrap broke `assetIdToHash.value` in registry computed**

- **Found during:** Task 1 — `metaStore.assetIdToHash.value` returned `undefined` because Pinia auto-unwraps `ref` on store instances
- **Fix:** Used `storeToRefs(metaStore)` to recover the actual `Ref<Map>` before reading `.value` in the computed
- **Files modified:** `useMoshpitAssetRegistry.ts`
- **Commit:** e559cbc53

## Reactivity Approach Confirmed

`storeToRefs(metaStore)` restores the `Ref<Map<string,string>>` that Pinia strips. The `computed()` in `useMoshpitAssetRegistry` reads `assetIdToHash.value` (the Map) inside the getter body — Vue tracks the ref as a reactive dependency. When `recordAssetHash` calls `.set()` on the Map, Vue detects the mutation and re-evaluates the computed. Verified by the OSS-path integration test asserting `entries.value` contains the new entry synchronously after `fireThumbReady`.

## Known Stubs

None — all data flows are wired. The three Pinia stores are Phase-2 scaffolds (curationStore has no mutation actions) but are intentional per plan spec; Phase 5 adds mutations.

## Pre-existing Typecheck Errors (Out of Scope)

Two errors existed on the base branch before this plan and are unrelated to files touched here:

- `MoshpitProcessingIndicator.test.ts` — references `.vue` component not yet created (different plan)
- `useMinimap.test.ts(854)` — comparison type overlap in minimap resize listener

## Self-Check: PASSED

All created files exist on disk. Commit e559cbc53 confirmed in git log. 14/14 tests green.
