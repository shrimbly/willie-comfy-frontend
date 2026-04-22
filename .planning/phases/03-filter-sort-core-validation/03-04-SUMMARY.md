---
phase: 03-filter-sort-core-validation
plan: '04'
subsystem: moshpit/services
tags: [moshpit, indexeddb, schema-migration, params-integration, tdd]
dependency_graph:
  requires:
    - src/platform/moshpit/services/paramNormalize.ts (plan 03-01)
  provides:
    - src/platform/moshpit/services/thumbRepository.types.ts (AssetMetaRecord.params, MOSHPIT_DB_VERSION=2)
    - src/platform/moshpit/services/thumbRepository.ts (v1→v2 upgrade callback)
  affects:
    - src/platform/moshpit/services/workerBridge.ts (plan 03-05 must replace emptyParams() with real params from worker)
    - src/platform/moshpit/stores/moshpitCurationStore.test.ts (stubParams fixture added)
tech_stack:
  added: []
  patterns:
    - idb openDB upgrade callback with async cursor-based migration
    - try/catch per-record migration (T-03-04-01 mitigation pattern)
    - emptyParams() as placeholder until worker extension (plan 03-05)
key_files:
  created: []
  modified:
    - src/platform/moshpit/services/thumbRepository.types.ts
    - src/platform/moshpit/services/thumbRepository.ts
    - src/platform/moshpit/services/thumbRepository.test.ts
    - src/platform/moshpit/services/workerBridge.ts
    - src/platform/moshpit/stores/moshpitCurationStore.test.ts
decisions:
  - MOSHPIT_DB_VERSION bumped 1→2; upgrade callback does force-on-open migration (not lazy-per-read)
  - emptyParams() written by workerBridge.ts until Plan 03-05 wires real params from worker message
  - Cursor-based streaming for O(1) memory migration regardless of record count
  - Per-record try/catch skips malformed records rather than aborting upgrade transaction
metrics:
  duration_minutes: 20
  completed_date: '2026-04-21'
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 5
---

# Phase 03 Plan 04: IDB Schema v2 — NormalizedParams Persistence

**One-liner:** IDB schema bumped 1→2 with `AssetMetaRecord.params: NormalizedParams` field and a cursor-based force-on-open v1→v2 migration that re-parses params for all existing records via `normalizeParams`.

## What Was Built

Extended the Moshpit IndexedDB schema (`moshpit-v1`) from version 1 to 2:

1. **`thumbRepository.types.ts`** — Added `import type { NormalizedParams }` from `paramNormalize` and extended `AssetMetaRecord` with a required `readonly params: NormalizedParams` field. `MOSHPIT_DB_VERSION` bumped from `1` to `2`.

2. **`thumbRepository.ts`** — Rewrote the `openDB` upgrade callback to be `async` and handle `oldVersion < 2`: iterates all existing `assetMeta` records via cursor, calls `normalizeParams(rec.metadata, Date.now())`, and writes the populated record back. Records already having `params` are skipped (idempotent guard). A per-record `try/catch` logs and skips malformed entries without aborting the upgrade transaction (T-03-04-01).

3. **`workerBridge.ts`** — Deviation fix: `putAssetMeta` call updated to include `params: emptyParams(Date.now())` to satisfy the now-required `AssetMetaRecord.params` field. Plan 03-05 will replace this with real params from the worker message.

4. **`moshpitCurationStore.test.ts`** — Deviation fix: `store.load()` fixtures updated with a `stubParams: NormalizedParams` object to satisfy the new required field.

5. **`thumbRepository.test.ts`** — Added 7 new tests: 5 in the main suite (v2 round-trip with full params, empty optional params, missing hash) and 4 migration scenario tests (seed v1 + upgrade, idempotence, empty store, already-migrated record).

## Migration Strategy: MOSHPIT_DB_VERSION 1 → 2

**Approach:** Force-on-open (not lazy-per-read). When `openMoshpitDB()` is called on a browser with v1 data, the `idb` upgrade callback fires synchronously before the DB promise resolves. All existing records are re-parsed in a single transaction.

**Why force-on-open:** Bounded, predictable, occurs once. Lazy-per-read would leave `params: undefined` until each record's next write — causing all assets to appear as "lacking sorted parameter" until re-processed. The force approach surfaces the migration cost at dogfood time where it's visible and bounded to the dev cache size.

**Memory characteristics:** Cursor-based O(1) — one record in memory at a time regardless of cache size.

**Error handling:** Per-record `try/catch`. If `normalizeParams` throws on a malformed `metadata` field, the record is skipped with a `console.error`. Its next IDB write (Plan 03-05 warm-cache path) will populate `params` correctly.

## Note for Plan 03-05

`AssetMetaRecord.params` is now a **required** field at compile time. Plan 03-05 (worker extension) must:

1. Add `params: NormalizedParams` to `ThumbReadyMessage` in `workerMessages.ts`
2. Have `thumbWorker.ts` call `normalizeParams(metadata, createdAtMs)` and include the result in the `thumbReady` post
3. Update `workerBridge.ts` `handleThumbReady` to pass `msg.params` instead of `emptyParams(Date.now())`

Until 03-05 lands, the workerBridge writes `emptyParams()` — assets will have empty params in IDB but the v1→v2 migration (if any v1 records exist) will have already re-parsed real params for legacy records.

## fake-indexeddb Quirks Encountered

None significant. The `fake-indexeddb/auto` global registered in `vitest.setup.ts` handles `openDB` cursor operations correctly. One subtlety: when seeding a v1 DB in tests using raw `idb.openDB('moshpit-v1', 1, ...)`, the test must `v1db.close()` before calling `openMoshpitDB()` — otherwise `idb`'s version upgrade is blocked by the open v1 handle. The test suite handles this correctly.

The `cachedDB` module-level singleton required `deleteMoshpitDB()` in `beforeEach` to reset state between tests. This was already the pattern from Phase 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] workerBridge.ts putAssetMeta missing required params field**

- **Found during:** Task 1 (TypeScript compile after adding required `params` to `AssetMetaRecord`)
- **Issue:** `workerBridge.ts` line 103 constructed `AssetMetaRecord` without `params`, causing TS2345 error
- **Fix:** Added `import { emptyParams } from './paramNormalize'` and `params: emptyParams(Date.now())` to the `putAssetMeta` call with a comment noting Plan 03-05 will replace this
- **Files modified:** `src/platform/moshpit/services/workerBridge.ts`
- **Commit:** `3344c728a`

**2. [Rule 1 - Bug] moshpitCurationStore.test.ts AssetMetaRecord fixtures missing params**

- **Found during:** Task 1 (TypeScript compile)
- **Issue:** Two `store.load()` calls passed `AssetMetaRecord` objects without `params`, causing TS2345 errors
- **Fix:** Added `stubParams: NormalizedParams` fixture with all-undefined optional fields and updated both `store.load()` calls to include it
- **Files modified:** `src/platform/moshpit/stores/moshpitCurationStore.test.ts`
- **Commit:** `3344c728a`

## Self-Check: PASSED

- [x] `src/platform/moshpit/services/thumbRepository.types.ts` — `MOSHPIT_DB_VERSION = 2` present
- [x] `src/platform/moshpit/services/thumbRepository.types.ts` — `params: NormalizedParams` present
- [x] `src/platform/moshpit/services/thumbRepository.types.ts` — `import type { NormalizedParams } from './paramNormalize'` present
- [x] `src/platform/moshpit/services/thumbRepository.ts` — `oldVersion < 2` branch present
- [x] `src/platform/moshpit/services/thumbRepository.ts` — `normalizeParams` imported and called
- [x] `src/platform/moshpit/services/thumbRepository.ts` — `openCursor` + `continue` (cursor-based streaming) present
- [x] Commit `3344c728a` exists (refactor — Task 1)
- [x] Commit `8330b49d9` exists (feat — Task 2)
- [x] 10 thumbRepository tests pass (was 3 before this plan)
- [x] 4 migration scenario tests in thumbRepository.test.ts (seed v1, idempotence, empty store, already-migrated)
- [x] 227 moshpit tests pass total
- [x] No TypeScript errors in moshpit service/store files
- [x] No lint errors on modified files
