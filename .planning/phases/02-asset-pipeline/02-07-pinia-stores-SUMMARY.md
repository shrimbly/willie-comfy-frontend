---
phase: 02-asset-pipeline
plan: '07'
subsystem: moshpit-stores
tags: [pinia, stores, wave-3, thumb, metadata, curation]
dependency_graph:
  requires:
    - 02-04 (thumbRepository.types.ts — CurationRecord, AssetMetaRecord types)
  provides:
    - moshpitThumbStore (URL cache, revoke-on-replace)
    - moshpitMetadataStore (parsed-meta map, excludedCount, assetIdToHash OSS bridge)
    - moshpitCurationStore (Phase 2 scaffold)
  affects:
    - 02-08 (useMoshpitProcessingQueue reads assetIdToHash; useMoshpitAssetRegistry reads getHashForAssetId)
    - 02-10 (Settings panel reads excludedCount from moshpitMetadataStore)
    - 02-11 (PixiJS canvas reads urlByHash from moshpitThumbStore)
tech_stack:
  added: []
  patterns:
    - Pinia setup-API defineStore
    - ref(new Map()) for reactive Maps
    - URL.createObjectURL / URL.revokeObjectURL lifecycle
key_files:
  created:
    - src/platform/moshpit/stores/moshpitThumbStore.ts
    - src/platform/moshpit/stores/moshpitThumbStore.test.ts
    - src/platform/moshpit/stores/moshpitMetadataStore.ts
    - src/platform/moshpit/stores/moshpitMetadataStore.test.ts
    - src/platform/moshpit/stores/moshpitCurationStore.ts
    - src/platform/moshpit/stores/moshpitCurationStore.test.ts
  modified: []
decisions:
  - 'Used ref(new Map()) for all stores — standard Pinia reactive pattern; Map mutates in place and Pinia tracks it correctly'
  - "assetIdToHash exposed as the underlying ref (not just via getter) so consumers' computed() can capture the dependency via .value access"
  - 'moshpitCurationStore is a Phase 2 read-only scaffold; Phase 5 will add toggle actions (favourite, tag, hide, folder) with IDB write-through'
metrics:
  duration: '~8 minutes'
  completed_date: '2026-04-21'
  tasks_completed: 1
  files_created: 6
  files_modified: 0
---

# Phase 02 Plan 07: Pinia Stores Summary

Three Pinia setup-API stores for the Moshpit reactive layer: `moshpitThumbStore` (URL.createObjectURL cache with revoke-on-replace), `moshpitMetadataStore` (parsed-metadata map + excludedCount + OSS-path assetId→contentHash bridge), and `moshpitCurationStore` (Phase 2 scaffold backed by CurationRecord map).

## Tasks Completed

| Task | Name                                                                                | Commit    | Files                        |
| ---- | ----------------------------------------------------------------------------------- | --------- | ---------------------------- |
| 1    | Create moshpitThumbStore + moshpitMetadataStore + moshpitCurationStore (with tests) | 5893adcca | 6 files (3 stores + 3 tests) |

## What Was Built

### moshpitThumbStore (`defineStore('moshpitThumb', ...)`)

- `addThumb(contentHash, blob)` — revokes the previous URL for the same hash before creating a new one (prevents blob memory leaks, T-02-07-01)
- `reset()` — revokes every outstanding URL; call on canvas unmount
- Exposes `urlByHash` (reactive ref), `size` (computed), `getUrl`, `has`, `addThumb`, `reset`

### moshpitMetadataStore (`defineStore('moshpitMetadata', ...)`)

- `setMetadata` / `getMetadata` — raw string key/value map per asset content hash
- `excludedCount` + `incrementExcluded` + `resetExcluded` — ASSET-06 surface for the Settings panel
- `assetIdToHash` (exposed reactive ref) + `recordAssetHash` + `getHashForAssetId` — OSS-path bridge: the processing queue populates this when the worker emits `thumbReady` for assets that lack a server `asset_hash`, enabling `useMoshpitAssetRegistry` to resolve `a.asset_hash ?? getHashForAssetId(a.id)` for local-backend thumbnails (ASSET-01 fix)
- `reset()` — clears all three data structures atomically

### moshpitCurationStore (`defineStore('moshpitCuration', ...)`)

- `load(record: AssetMetaRecord)` — hydrates from IDB on init
- `get(contentHash)` — returns `CurationRecord | undefined`
- `reset()` — clears the map
- Phase 5 will add mutation actions (favourite, tag, hide, folder) with IDB write-through

## Test Coverage

10 tests total across 3 test files:

- `moshpitThumbStore.test.ts` (3 tests): addThumb → URL created; duplicate hash → old URL revoked; reset → all URLs revoked
- `moshpitMetadataStore.test.ts` (4 tests): setMetadata/getMetadata round-trip; incrementExcluded/resetExcluded; recordAssetHash/getHashForAssetId round-trip with overwrite; reset clears all three data structures
- `moshpitCurationStore.test.ts` (3 tests): load/get round-trip; get returns undefined for unknown; reset clears

## Reactivity Approach

`assetIdToHash` is exposed as `ref(new Map<string, string>())` — the underlying reactive ref — rather than only via `getHashForAssetId()`. This ensures `computed()` in `useMoshpitAssetRegistry` (Plan 08) can capture the dependency via `.value` access when iterating assets. The registry will use `metaStore.assetIdToHash.value.get(a.id)` which correctly re-runs on `recordAssetHash` calls.

If this proves insufficient in integration (no re-render despite set), the fallback is a `customRef` trigger or a `ref<Record<string, string>>` swap. Plan 08's integration test will confirm end-to-end reactivity.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Mitigations Applied

| Threat                                         | Mitigation                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| T-02-07-01: Object URL leakage                 | `addThumb` revokes prior URL; `reset` revokes all. Both paths covered by unit tests.               |
| T-02-07-02: Metadata mutation                  | `setMetadata` accepts `Readonly<Record<string, string>>`; TypeScript prevents accidental mutation. |
| T-02-07-04: assetIdToHash stale-after-reassign | `recordAssetHash` overwrites on re-call; registry reads the reactive ref for latest value.         |

## Known Stubs

None. All public APIs are wired and exercised by tests.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `src/platform/moshpit/stores/moshpitThumbStore.ts` — FOUND
- `src/platform/moshpit/stores/moshpitMetadataStore.ts` — FOUND
- `src/platform/moshpit/stores/moshpitCurationStore.ts` — FOUND
- `src/platform/moshpit/stores/moshpitThumbStore.test.ts` — FOUND
- `src/platform/moshpit/stores/moshpitMetadataStore.test.ts` — FOUND
- `src/platform/moshpit/stores/moshpitCurationStore.test.ts` — FOUND
- Commit `5893adcca` — EXISTS
- 10/10 tests PASS
- No `any` usage in store files
- No type errors introduced by new files
