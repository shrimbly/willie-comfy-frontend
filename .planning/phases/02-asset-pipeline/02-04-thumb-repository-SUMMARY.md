---
phase: 02-asset-pipeline
plan: '04'
subsystem: moshpit-persistence
tags: [indexeddb, idb, thumbnail-cache, curation, wave-1]
requirements: [ASSET-03, ASSET-04]

dependency_graph:
  requires:
    - '02-01: idb dep + fake-indexeddb test infra (Wave 1 parallel)'
  provides:
    - 'thumbRepository API for thumbWorker + workerBridge (02-05)'
    - 'defaultCuration() contract for Phase 5 curation mutations'
    - 'MoshpitDB schema contract — MOSHPIT_DB_VERSION=1'
  affects:
    - '02-05: workerBridge calls putThumb + putAssetMeta after thumbReady'
    - 'Phase 5: reads/writes assetMeta.curation via getAssetMeta + putAssetMeta'

tech_stack:
  added:
    - 'idb v7 (openDB, IDBPDatabase) — explicit usage of Firebase transitive dep'
  patterns:
    - 'Singleton DB handle with lazy init (openMoshpitDB)'
    - 'Typed idb schema via MoshpitDB extends DBSchema generic'
    - 'Test teardown via raw indexedDB.deleteDatabase (only idiomatic raw IDB usage)'

key_files:
  created:
    - src/platform/moshpit/services/thumbRepository.types.ts
    - src/platform/moshpit/services/thumbRepository.ts
  modified: []

decisions:
  - 'Split schema into types file (thumbRepository.types.ts) to allow clean import by test file without pulling in openDB side effects'
  - "MOSHPIT_DB_NAME='moshpit-v1', MOSHPIT_DB_VERSION=1 exported as named constants so future version bump is a single-line change"
  - 'terminated() callback sets cachedDB=null so next openMoshpitDB() re-opens after browser kills the connection'
  - "deleteMoshpitDB() uses raw indexedDB.deleteDatabase — idb has no typed delete-whole-DB helper; this is the documented exception to the 'idb only' rule"
  - 'getAllThumbHashes returns string[] via db.getAllKeys typed by MoshpitDB schema — no cast needed'

metrics:
  duration: '~8 minutes'
  completed: '2026-04-21'
  tasks_completed: 1
  tasks_total: 1
  files_created: 2
  files_modified: 0
---

# Phase 02 Plan 04: Thumb Repository Summary

IndexedDB repository with typed idb v7 schema backing ASSET-03 (thumbnail cache) and ASSET-04 (curation state). Two object stores, singleton DB handle, 8 named exports. ~110 lines implementation + ~50 lines types.

## What Was Built

**`thumbRepository.types.ts`** — Pure type exports:

- `CurationRecord` — `{ favourite, tags, folders, hidden }` readonly; Phase 5 mutation target
- `ThumbRecord` — `{ contentHash, blob, width, height, generatedAt }` readonly
- `AssetMetaRecord` — `{ contentHash, metadata, curation }` readonly
- `MoshpitDB extends DBSchema` — idb typed schema with `thumbs` and `assetMeta` stores
- `MOSHPIT_DB_NAME = 'moshpit-v1'`, `MOSHPIT_DB_VERSION = 1`

**`thumbRepository.ts`** — 8 named exports:

- `openMoshpitDB()` — lazy singleton; creates both stores on upgrade; `blocked`/`terminated` handlers
- `defaultCuration()` — returns a new `CurationRecord` literal on every call (no shared refs)
- `putThumb(record)` / `getThumb(contentHash)` / `getAllThumbHashes()` — ASSET-03 cache ops
- `putAssetMeta(record)` / `getAssetMeta(contentHash)` — ASSET-04 curation ops
- `deleteMoshpitDB()` — test teardown; closes handle, resets cache, deletes via raw IDB

## Phase 5 Upgrade Path

When Phase 5 adds a by-tag index for `FILTER-07`:

1. Bump `MOSHPIT_DB_VERSION` to `2`
2. Add an `upgrade` branch for `newVersion === 2` that calls `assetMetaStore.createIndex('by-tag', 'curation.tags', { multiEntry: true })`
3. The `openMoshpitDB` `upgrade` callback already guards with `objectStoreNames.contains` so existing v1 paths are safe

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this is a pure persistence layer. No UI rendering, no data flowing to templates.

## Threat Flags

None beyond what the plan's threat model documents. The `metadata` field typed as `Readonly<Record<string, string>>` is the mitigation for T-02-04-03 — no executable interpretation at this layer.

## Self-Check

- `src/platform/moshpit/services/thumbRepository.ts` exists: FOUND
- `src/platform/moshpit/services/thumbRepository.types.ts` exists: FOUND
- Commit `58a1d2379` exists: FOUND
- `grep "interface MoshpitDB extends DBSchema"`: MATCH
- `grep "createObjectStore('thumbs'"`: MATCH
- `grep "createObjectStore('assetMeta'"`: MATCH
- Export count: 8 (openMoshpitDB, defaultCuration, putThumb, getThumb, getAllThumbHashes, putAssetMeta, getAssetMeta, deleteMoshpitDB)
- `grep "as any|: any"`: 0 matches

## Self-Check: PASSED
