---
phase: 03-filter-sort-core-validation
plan: '05'
subsystem: moshpit/worker+store
tags: [moshpit, worker, pinia-store, params-integration, tdd]
dependency_graph:
  requires:
    - src/platform/moshpit/services/paramNormalize.ts (plan 03-01)
    - src/platform/moshpit/services/thumbRepository.types.ts (plan 03-04, IDB v2)
  provides:
    - src/platform/moshpit/services/workerMessages.ts (ThumbReadyMessage.params)
    - src/platform/moshpit/services/thumbWorker.ts (ProcessCtx.normalize + .now, deriveFilenameFromAssetInput)
    - src/platform/moshpit/stores/moshpitMetadataStore.ts (paramsByHash ref + setParams/getParams)
    - src/platform/moshpit/composables/useMoshpitProcessingQueue.ts (timestamp overwrite + warm-cache IDB load)
  affects:
    - src/platform/moshpit/composables/useMoshpitWorkflowOptions.ts (reads paramsByHash.get — now explicit ref)
    - 03-06 (moshpitFilterStore will consume paramsByHash as the reactive source for filter chips)
    - 03-10 (integration will verify end-to-end cold + warm paths)
tech_stack:
  added: []
  patterns:
    - ProcessCtx injectable dependencies for normalize + now (worker-safe, fully testable)
    - deriveFilenameFromAssetInput: URL.pathname last segment extraction
    - Explicit Ref<Map> paramsByHash + setParams/getParams (replaces computed re-parse from Plan 03-07)
    - Chunk-size-10 Promise.allSettled for warm-cache IDB reads (T-03-05-02)
    - TDD red-green cycle for both tasks
key_files:
  created: []
  modified:
    - src/platform/moshpit/services/workerMessages.ts
    - src/platform/moshpit/services/thumbWorker.ts
    - src/platform/moshpit/services/thumbWorker.test.ts
    - src/platform/moshpit/services/workerBridge.ts
    - src/platform/moshpit/services/workerBridge.test.ts
    - src/platform/moshpit/stores/moshpitMetadataStore.ts
    - src/platform/moshpit/stores/moshpitMetadataStore.test.ts
    - src/platform/moshpit/composables/useMoshpitProcessingQueue.ts
    - src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts
    - src/platform/moshpit/composables/useMoshpitWorkflowOptions.test.ts
decisions:
  - paramsByHash changed from computed (re-parsing metaByHash) to explicit Ref<Map> + setParams/getParams
  - deriveFilenameFromAssetInput uses URL.pathname last segment; falls back to string split for non-URL fetchUrls
  - Warm-cache chunk size = 10 concurrent IDB reads (bounds memory, keeps IDB reads pipelined)
  - timestamp overwrite uses Number.isFinite guard — NaN from invalid ISO string falls back to msg.params.timestamp
  - useMoshpitWorkflowOptions tests updated to call setParams alongside setMetadata (explicit ref requires it)
metrics:
  duration_minutes: 35
  completed_date: '2026-04-21'
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 10
---

# Phase 03 Plan 05: NormalizedParams Worker Pipeline Wiring

**One-liner:** Worker pipeline end-to-end: `processAsset` calls `ctx.normalize(metadata, now(), sourceFilename)` and includes `params` in `thumbReady`; bridge forwards `msg.params` to IDB; `moshpitMetadataStore` exposes explicit `paramsByHash` ref with `setParams`/`getParams`; queue overwrites `params.timestamp` with real `AssetItem.created_at`.

## What Was Built

### Task 1: Worker contract + thumbWorker + bridge

**`workerMessages.ts`** — v2 contract bump: `ThumbReadyMessage` gains `readonly params: NormalizedParams`. Comment updated to document the structured-clone boundary.

**`thumbWorker.ts`** — Three additions:

1. `ProcessCtx` gains `normalize` and `now` injectable dependencies (fully testable, no globals in the hot path)
2. `deriveFilenameFromAssetInput(input)` — pure helper that extracts the last URL path segment from `input.fetchUrl` via `new URL()` with fallback to string split for relative paths. Returns `null` for empty segments.
3. `processAsset` calls `ctx.now()` once after the hash step, then `ctx.normalize(metadata, createdAtMs, sourceFilename)`, and includes `params` in the `thumbReady` post.

Worker shell wires `normalize: normalizeParams` and `now: () => Date.now()`.

**`workerBridge.ts`** — `handleThumbReady` passes `params: msg.params` to `putAssetMeta`, replacing the `emptyParams(Date.now())` stub from Plan 03-04.

**Tests added:**

- `thumbWorker.test.ts`: 5 new tests (params in thumbReady, ctx.now() called once, normalize called with sourceFilename, normalize not called on empty-metadata excluded, normalize not called on fetch-failed excluded)
- `workerBridge.test.ts`: 1 new test (putAssetMeta stores msg.params verbatim — verified via getAssetMeta round-trip); existing 2 tests updated to include required `params` field in fake.emit()

### Task 2: paramsByHash store + processing queue timestamp + warm-cache

**`moshpitMetadataStore.ts`** — Replaced the Plan 03-07 computed derivation of `paramsByHash` with:

- `_paramsByHash: ref(new Map<string, NormalizedParams>())` — internal mutable ref
- `paramsByHash: computed(() => _paramsByHash.value)` — exposed as a computed (Pinia auto-unwraps to `Map` on store access)
- `setParams(contentHash, params)` — writes to the ref
- `getParams(contentHash)` — reads from the ref
- `reset()` now clears `_paramsByHash` alongside `metaByHash`

**`useMoshpitProcessingQueue.ts`** — Two additions:

1. `assetsSnapshot` ref — set to `assets` at the start of each `setFilter` call. On `thumbReady`, looks up the matching `AssetItem` by `assetId` and overwrites `params.timestamp` with `new Date(asset.created_at).getTime()`. Falls back to `msg.params.timestamp` when the asset is not found or `created_at` is invalid (guarded by `Number.isFinite`).
2. Warm-cache path — after computing the delta, iterates cached asset views in chunks of 10, calls `getAssetMeta(hash)`, and populates both `metaStore.setMetadata` and `metaStore.setParams` from the IDB record. This ensures `paramsByHash` is fully populated on warm-cache re-entry without re-running the worker.

**Tests added:**

- `moshpitMetadataStore.test.ts`: 4 new tests (setParams/getParams round-trip, getParams unknown hash, reset clears paramsByHash, reactive update via setParams)
- `useMoshpitProcessingQueue.test.ts`: 3 new tests (timestamp overwrite with real created_at, fallback timestamp for unknown assetId, warm-cache populates paramsByHash from getAssetMeta)

## Source Filename Threading (ProcessCtx.normalize)

The `deriveFilenameFromAssetInput` helper extracts the filename from the worker's `fetchUrl`:

```
'https://comfy.host/outputs/my_cfg_sweep_00042_.png'
  → 'my_cfg_sweep_00042_.png'   (URL.pathname last segment)
```

This is passed as the third argument to `ctx.normalize` (which is `normalizeParams`). Inside `normalizeParams`, `extractWorkflowFilename` strips the counter suffix and extension:

```
'my_cfg_sweep_00042_.png' → 'my_cfg_sweep'
```

The resulting `workflowFilename` flows through the IDB record and `paramsByHash` to the workflow picker's `displayName`.

## params.timestamp Correction

The worker uses `ctx.now()` (= `Date.now()`) as a fallback when no canonical creation timestamp is available. The processing queue corrects this on `thumbReady`:

```typescript
const asset = assetsSnapshot.value.find((a) => a.id === msg.assetId)
const createdAtMs = asset?.created_at
  ? new Date(asset.created_at).getTime()
  : NaN
const paramsWithRealTimestamp: NormalizedParams = {
  ...msg.params,
  timestamp: Number.isFinite(createdAtMs) ? createdAtMs : msg.params.timestamp
}
metaStore.setParams(msg.contentHash, paramsWithRealTimestamp)
```

The `Number.isFinite` guard handles invalid ISO strings and missing `created_at` values gracefully.

## Warm-Cache Batch Size

Chunk size = 10 concurrent `getAssetMeta` calls via `Promise.allSettled`. This bounds the concurrent IDB reads regardless of how many cached assets are present (T-03-05-02 mitigation). For Plan 03-10 integration tuning:

- 10 is conservative for IndexedDB (which handles ~100 concurrent reads without issue on desktop Chrome)
- If profiling shows slow warm-cache populate on large catalogs, raise to 25–50
- `Promise.allSettled` is correct here (individual IDB failures are silently skipped)

## Note for Plan 03-06

`moshpitMetadataStore.paramsByHash` is the reactive source that Plan 03-06 (filter store + composable) should consume. It is a `ComputedRef<Map<string, NormalizedParams>>` that Pinia exposes as a plain `Map` at the store access boundary. Filter composables read: `metaStore.paramsByHash.get(contentHash)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useMoshpitProcessingQueue.test.ts ThumbReadyMessage missing required params field**

- **Found during:** Task 1 typecheck after adding `params: NormalizedParams` to `ThumbReadyMessage`
- **Issue:** Existing test's `fireThumbReady` call lacked the now-required `params` field, causing TS2345
- **Fix:** Added `params: emptyParams(Date.now())` to the `fireThumbReady` call in the existing test
- **Files modified:** `src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts`
- **Commit:** `0fe9a0c50`

**2. [Rule 1 - Bug] useMoshpitWorkflowOptions.test.ts relied on computed paramsByHash derived from metaByHash**

- **Found during:** Task 2 — full moshpit test run after switching paramsByHash to explicit ref
- **Issue:** 4 tests called `setMetadata` expecting `paramsByHash` to auto-derive params; the new explicit ref requires `setParams` to be called separately
- **Fix:** Added `seedAsset` helper that calls both `setMetadata` and `setParams(normalizeParams(meta, ...))`. Updated all 4 failing tests to use `seedAsset`; also updated 2 inline tests to call `setParams` directly.
- **Files modified:** `src/platform/moshpit/composables/useMoshpitWorkflowOptions.test.ts`
- **Commit:** `487097dc0`

## Self-Check: PASSED

- [x] `grep "readonly params: NormalizedParams" src/platform/moshpit/services/workerMessages.ts` — FOUND
- [x] `grep "normalizeParams" src/platform/moshpit/services/thumbWorker.ts` — FOUND (import + shell wiring)
- [x] `grep "ctx.normalize" src/platform/moshpit/services/thumbWorker.ts` — FOUND (called in processAsset)
- [x] `grep "deriveFilenameFromAssetInput" src/platform/moshpit/services/thumbWorker.ts` — FOUND (defined + called)
- [x] `grep "params: msg.params" src/platform/moshpit/services/workerBridge.ts` — FOUND
- [x] `grep "paramsByHash" src/platform/moshpit/stores/moshpitMetadataStore.ts` — 6 matches (ref, computed, return, reset clear, 2 others)
- [x] `grep -E "setParams|getParams" src/platform/moshpit/stores/moshpitMetadataStore.ts` — 4 matches (2 functions + 2 return entries)
- [x] `grep "metaStore.setParams" src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` — 2 matches (thumbReady + warm-cache)
- [x] `grep "created_at" src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` — FOUND
- [x] `grep "getAssetMeta" src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` — FOUND (warm-cache path)
- [x] Commit `0fe9a0c50` — FOUND (Task 1)
- [x] Commit `487097dc0` — FOUND (Task 2)
- [x] 252 moshpit tests pass (229 in services/stores/composables + 23 components)
- [x] No TypeScript errors in modified files (only pre-existing thumbRepository.ts cursor typing issue from Plan 03-04)
- [x] No new lint errors introduced
