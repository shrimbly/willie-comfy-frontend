---
phase: 260423-m6c
plan: 01
subsystem: moshpit
tags: [persistence, indexeddb, moshpit, overrides]
requires:
  - MoshpitDB v3 (thumbRepository)
  - idb package (already a dep)
provides:
  - MoshpitDB v4 schema with overrides object store
  - overrideRepository service (load/save/delete/clearAll)
  - moshpitOverrideStore.hydrate() + debounced persist
affects:
  - MoshpitLayout.vue boot sequence
tech-stack:
  added: []
  patterns:
    - 'Per-hash timer Map for debounced IDB writes'
    - 'Shared DB connection across sibling repositories via getMoshpitDB()'
key-files:
  created:
    - src/platform/moshpit/services/overrideRepository.ts
    - src/platform/moshpit/services/overrideRepository.test.ts
  modified:
    - src/platform/moshpit/services/thumbRepository.ts
    - src/platform/moshpit/services/thumbRepository.types.ts
    - src/platform/moshpit/services/thumbRepository.test.ts
    - src/platform/moshpit/stores/moshpitOverrideStore.ts
    - src/platform/moshpit/stores/moshpitOverrideStore.test.ts
    - src/views/layouts/MoshpitLayout.vue
decisions:
  - 'Option A (exported getMoshpitDB accessor) chosen over extracting a separate moshpitDb.ts — smaller diff, no churn for existing consumers.'
  - 'OverridePersistedRecord declared in thumbRepository.types.ts (not overrideRepository.ts) to avoid circular import between schema and repo.'
  - '100ms setTimeout per-hash Map debouncer chosen over @vueuse/core useDebounceFn — trivially testable with vi.useFakeTimers and no extra import.'
  - 'Repository errors are swallowed with console.warn; in-memory store state is source-of-truth and must not be blocked by persistence failures.'
metrics:
  duration_minutes: ~15 (resume)
  tasks: 2
  commits: 2
  non_test_loc: 196
  test_loc_added: ~330
completed: 2026-04-23
---

# Quick 260423-m6c: Persist Moshpit sprite overrides (pins + scales) Summary

Persist `moshpitOverrideStore` (pinned world positions + manual scales) to IndexedDB so manual pins and resizes survive page reloads. Previously pins/scales were lost on every reload.

## Files touched (non-test LoC)

| File                                                     | Status   | Non-test Δ               |
| -------------------------------------------------------- | -------- | ------------------------ |
| `src/platform/moshpit/services/overrideRepository.ts`    | created  | +69                      |
| `src/platform/moshpit/services/thumbRepository.ts`       | modified | +19                      |
| `src/platform/moshpit/services/thumbRepository.types.ts` | modified | +20 / -1                 |
| `src/platform/moshpit/stores/moshpitOverrideStore.ts`    | modified | +82 / -1                 |
| `src/views/layouts/MoshpitLayout.vue`                    | modified | +8                       |
| **Total (non-test)**                                     |          | **+196 LoC** (≤ 300 cap) |

Tests added/extended:

- `src/platform/moshpit/services/overrideRepository.test.ts` (new, 10 cases)
- `src/platform/moshpit/stores/moshpitOverrideStore.test.ts` (extended with 12 new persistence-wiring cases; existing 16 in-memory cases untouched)
- `src/platform/moshpit/services/thumbRepository.test.ts` (version-expectation bumps 3 → 4; no new cases)

## Schema version bump

- `MOSHPIT_DB_VERSION`: `3` → `4`.
- `MoshpitDB` gains `overrides: { key: string; value: OverridePersistedRecord }`.
- Upgrade branch `if (oldVersion < 4) db.createObjectStore('overrides', { keyPath: 'contentHash' })` appended to existing `upgrade(db, oldVersion)` callback. v2/v3 branches untouched.
- Verified by dedicated test: seed a v3 DB with a thumb record via raw `idb.openDB(MOSHPIT_DB_NAME, 3, ...)`, then open via `openMoshpitDB()` — confirms v4 upgrade adds the `overrides` store AND preserves the pre-existing `thumbs`/`assetMeta` records.
- No data migration pass on existing stores (overrides has no legacy data to seed from).

## API surface

### overrideRepository (new)

```ts
export interface OverridePersistedRecord {
  readonly contentHash: string
  readonly pinnedWorldPos?: { readonly x: number; readonly y: number }
  readonly scale?: number
  readonly pinnedAt: number
}

export async function loadAllOverrides(): Promise<OverridePersistedRecord[]>
export async function saveOverride(
  record: OverridePersistedRecord
): Promise<void>
export async function deleteOverride(contentHash: string): Promise<void>
export async function clearAllOverrides(): Promise<void>
```

`loadAllOverrides` defensively skips malformed records (invalid `contentHash`, non-finite `pinnedAt`, non-finite `pinnedWorldPos.x/y`, non-finite `scale`) with a `console.warn`; never throws.

### moshpitOverrideStore (extended)

Added `hydrate(): Promise<void>`; all other public mutation signatures unchanged. Downstream consumers (`useMoshpitSpriteDrag`, `useMoshpitSpriteResize`, `useMoshpitSpriteActions`, `MoshpitSpriteContextMenu`, `MoshpitFloatingActionBar`, `useMoshpitSpriteLayer`) compile unchanged and their 87 existing tests all pass.

## Persistence semantics

| Mutation                             | Effect on Map                            | Effect on IDB (after 100ms)                                         |
| ------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------- |
| `setPin(hash, pos)`                  | sets `pinnedWorldPos`, preserves `scale` | `saveOverride({ contentHash, pinnedWorldPos, scale?, pinnedAt })`   |
| `setScale(hash, s)`                  | sets `scale`, preserves `pinnedWorldPos` | `saveOverride(...)`                                                 |
| `unpin(hash)` — scale remains        | drops `pinnedWorldPos`                   | `saveOverride({ scale, pinnedAt })` (no pinnedWorldPos)             |
| `unpin(hash)` — nothing remains      | removes record                           | `deleteOverride(hash)`                                              |
| `clearScale(hash)` — pin remains     | drops `scale`                            | `saveOverride({ pinnedWorldPos, pinnedAt })`                        |
| `clearScale(hash)` — nothing remains | removes record                           | `deleteOverride(hash)`                                              |
| `clear(hash)`                        | removes record                           | `deleteOverride(hash)`                                              |
| `clearAll()`                         | empties Map                              | cancels all pending timers, calls `clearAllOverrides()` immediately |

Rapid successive mutations to the same hash coalesce into a single IDB write (verified by test). Repository errors are `.catch((err) => console.warn(...))` — in-memory Map state unaffected.

## Test status

| Suite                                     | Cases | Status                                  |
| ----------------------------------------- | ----- | --------------------------------------- |
| `overrideRepository.test.ts` (new)        | 10    | ✅                                      |
| `thumbRepository.test.ts` (updated)       | 16    | ✅                                      |
| `moshpitOverrideStore.test.ts` (extended) | 28    | ✅                                      |
| Downstream consumer suites (6 files)      | 87    | ✅ — public API source-compat confirmed |

`pnpm typecheck` clean.

## Commits

| Hash        | Message                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `a91da275a` | feat(260423-m6c): add MoshpitDB v4 overrides store + overrideRepository |
| `ae70d53f8` | feat(260423-m6c): hydrate + debounced persist in moshpitOverrideStore   |

## Deviations from the plan

None material. Minor notes:

1. **Task 1 action #1** asked for the type in `thumbRepository.types.ts`. Previous executor had already landed this shape (readonly). Kept the `readonly` modifiers so `OverridePersistedRecord` is immutable at the type level — matches project convention for record types.
2. The plan did not explicitly call out updating existing `thumbRepository.test.ts` version assertions (they hardcoded `db.version === 3`). Three assertions were bumped to `4` — a mechanical consequence of the schema bump, not a behaviour change.
3. Added a `get` mutation path: `clear(hash)` explicitly calls `schedulePersist(hash)`; debounce fires `deleteOverride` (because the record is gone by that point). Plan said "schedule deleteOverride" directly — functionally equivalent via the unified `schedulePersist` code path that reads current state at fire time.

## Known stubs

None. All mutations wired to persistence; `hydrate()` wired into layout boot.

## Manual verification checklist (post-merge smoke)

- [ ] Pin a sprite → reload → sprite still pinned at the same world position.
- [ ] Resize a sprite → reload → scale persists.
- [ ] Unpin / clear scale → reload → override stays cleared.
- [ ] Clear all pins → reload → overrides store empty.
- [ ] Fresh user (no existing IDB) → Moshpit opens without errors, v4 DB created from scratch.
- [ ] Existing user at v3 → opens Moshpit → v4 migration runs once, thumbs/metadata/curation preserved.

## Self-Check: PASSED

- `src/platform/moshpit/services/overrideRepository.ts`: FOUND
- `src/platform/moshpit/services/overrideRepository.test.ts`: FOUND
- `src/platform/moshpit/stores/moshpitOverrideStore.ts` (hydrate + persist): FOUND
- `src/views/layouts/MoshpitLayout.vue` (hydrate call): FOUND
- Commit `a91da275a`: FOUND
- Commit `ae70d53f8`: FOUND
- `MOSHPIT_DB_VERSION === 4`: confirmed
- Public API of moshpitOverrideStore source-compatible: confirmed (87 downstream tests pass)
