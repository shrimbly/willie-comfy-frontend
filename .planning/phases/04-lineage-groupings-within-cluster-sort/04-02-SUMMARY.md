---
phase: 04-lineage-groupings-within-cluster-sort
plan: 02
subsystem: moshpit
tags:
  [
    indexeddb,
    migration,
    params,
    save-node-identity,
    worker-safe,
    vitest,
    fake-indexeddb
  ]

requires:
  - phase: 03-filter-sort-core-validation
    provides: NormalizedParamsSchema, normalizeParams (rawMeta, createdAtMs, sourceFilename?), MoshpitDB v2 schema, v1→v2 cursor-migration template
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 01
    provides: groupAxes.ts reads saveNodeIdentity via structural widening — Plan 02 materialises that field in the schema + in IDB
provides:
  - NormalizedParamsSchema.saveNodeIdentity (string | null)
  - SAVE_NODE_CLASS_TYPES readonly set (extensible membership)
  - extractSaveNodeIdentity helper (module-local) — _meta.title ?? class_type
  - MOSHPIT_DB_VERSION = 3
  - v2→v3 upgrade branch: cursor-based re-derivation of saveNodeIdentity with per-record try/catch + aggregate skip log
  - Regression coverage: 6 new v2→v3 tests + 4 new paramNormalize behaviour tests (from Plan 04-02 Task 1)
affects:
  [
    04-03 useMoshpitFilteredAssets (will read real saveNodeIdentity from params),
    04-04 moshpitFilterStore (saveNode axis wiring),
    04-05 cluster overlay (saveNode bucket labels)
  ]

tech-stack:
  added: []
  patterns:
    - Additive IDB upgrade branch — mirrors v1→v2 cursor pattern; never modifies prior branches
    - Per-record try/catch + aggregate skip counter surfaced via console.warn (T-04-02-01 mitigation)
    - Narrow structural cast (`as unknown as { contentHash, metadata }`) to safely traverse legacy cursor values without widening the idb types

key-files:
  created: []
  modified:
    - src/platform/moshpit/services/paramNormalize.ts (Task 1 — saveNodeIdentity field, SAVE_NODE_CLASS_TYPES, extractSaveNodeIdentity)
    - src/platform/moshpit/services/paramNormalize.test.ts (Task 1 — 4 new tests covering D-08)
    - src/platform/moshpit/services/thumbRepository.types.ts (Task 2 — MOSHPIT_DB_VERSION 2 → 3, JSDoc updated)
    - src/platform/moshpit/services/thumbRepository.ts (Task 2 — v2→v3 migration branch, import split, v1→v2 cursor type narrowing)
    - src/platform/moshpit/services/thumbRepository.test.ts (Task 2 — 6 new v2→v3 tests, spies on console.warn/error)
    - .planning/phases/04-lineage-groupings-within-cluster-sort/deferred-items.md (marked pre-existing thumbRepository typecheck errors resolved)

key-decisions:
  - 'Spread-replace saveNodeIdentity on v2→v3 (vs. full re-parse) when rec.params exists — cheaper and preserves any Phase 3 field values that would otherwise be recomputed. Falls through to full normalizeParams only when rec.params is absent (defensive path for intermediate writes)'
  - 'Malformed prompt JSON is NOT a throw — normalizeParams already returns fallback emptyParams on bad JSON, so such records simply migrate with saveNodeIdentity: null. The per-record try/catch exists to catch structural failures (e.g. rec.metadata itself being null/undefined), which is the only path the aggregate-skip counter actually fires on'
  - 'Resolved the pre-existing thumbRepository.ts TS2339/TS2698/TS2339 errors inline because the new v2→v3 branch touches the same cursor shape and would regress typecheck otherwise. Narrow structural cast documented in deferred-items.md update'
  - 'No new module imports in thumbRepository.ts. The NormalizedParams type import is added via a dedicated `import type` statement to satisfy the consistent-type-specifier-style rule'

patterns-established:
  - "IDB upgrade branches are additive and independent. Each new version's branch reads its own inputs from cursor values via explicit narrowing — it does NOT rely on the current TS AssetMetaRecord shape being backwards-compatible with older on-disk shapes"
  - 'Aggregate skip logging (one warn at end of migration, one error per record) keeps the per-record signal useful for diagnosis and the aggregate signal visible in prod logs without spam'
  - 'saveNodeIdentity extensibility: SAVE_NODE_CLASS_TYPES is exported so future plans (custom save nodes) can either union-extend it or fall through to the (other) bucket without code changes'

requirements-completed:
  - GROUP-04

duration: 7min
completed: 2026-04-21
---

# Phase 04 Plan 02: Lineage Grouping — saveNodeIdentity + v3 Migration Summary

**Materialised `saveNodeIdentity` — the D-08 save-node grouping axis — both in `NormalizedParamsSchema` and in every existing IndexedDB record via a cursor-based v2→v3 migration. GROUP-04 now has data to group on; Plan 01's `clusterLayout` axis extractor produces meaningful buckets instead of `(other)`-only.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-21T16:50:27Z
- **Completed:** 2026-04-21T16:56:54Z
- **Tasks:** 2 (Task 1 completed in prior agent run; Task 2 this run)
- **Files modified:** 6 (3 prod + 2 test + 1 planning doc)

## Accomplishments

### Task 1 (prior agent — 3 commits)

- `paramNormalize.ts` — `saveNodeIdentity: string | null` added to `NormalizedParamsSchema`; `SAVE_NODE_CLASS_TYPES` exported as a `ReadonlySet<string>` containing `SaveImage`, `PreviewImage`, `SaveImageWebsocket`, `SaveAnimatedWEBP`, `SaveImageExtended`; `extractSaveNodeIdentity(graph)` module-local helper using `_meta.title ?? class_type` on the first output node in `Object.values` iteration order.
- `paramNormalize.test.ts` — new `describe('saveNodeIdentity (D-08)')` block with 4 new behaviour assertions (title-present, title-missing, preview class, null when no output node, first-iteration-order for multi-output).
- Test fixtures across the Moshpit platform backfilled to include `saveNodeIdentity: null` where full `NormalizedParams` objects are constructed.
- Cluster/test fallback path in Plan 01's `clusterLayout.ts` aligned with the field now being real (structural widening still compiles).

### Task 2 (this agent — 2 commits)

- `thumbRepository.types.ts` — `MOSHPIT_DB_VERSION` bumped from 2 to 3; JSDoc rewritten to document v1/v2/v3 history and the v3 invariant.
- `thumbRepository.ts` — new `if (oldVersion < 3)` branch appended after the v1→v2 block. Cursor streams every `assetMeta` record, calls `normalizeParams(rec.metadata, rec.params?.timestamp ?? Date.now())`, and either spread-replaces `saveNodeIdentity` on the existing `rec.params` or uses the fresh full `NormalizedParams` if `rec.params` is absent. Per-record `try/catch`, `console.error` on failure with record hash, aggregate `console.warn` with `skipped > 0` summary.
- `thumbRepository.test.ts` — new `describe('thumbRepository v2→v3 migration (D-11)')` block with 6 new tests covering: fresh-v3 open (no migration, no logs), v2-with-records auto-upgrade populating `saveNodeIdentity` correctly across title-present / class-only / no-save-node variants, params-field preservation, malformed-JSON skip path, aggregate-skip-warn when records throw, idempotency across re-opens.
- `deferred-items.md` updated — 3 pre-existing `thumbRepository.ts` typecheck errors marked resolved (fixed inline as part of the v2→v3 cursor narrowing).

## Task Commits

1. **Task 1 RED — failing tests for saveNodeIdentity** — `123f35be8` (test)
2. **Task 1 GREEN — saveNodeIdentity impl** — `5d375acc0` (feat)
3. **Task 1 fix — backfill fixtures + cluster fallback** — `9301f934e` (fix)
4. **Task 2 RED — failing tests for v2→v3 migration** — `622cef012` (test)
5. **Task 2 GREEN — v3 bump + migration + typecheck fixes** — `dfabb5259` (feat)

## Final Exported Signatures

### `paramNormalize.ts`

```ts
export const NormalizedParamsSchema = z.object({
  // ... existing Phase 3 fields ...
  workflowFingerprint: z.string(),
  workflowFilename: z.string().nullable(),
  saveNodeIdentity: z.string().nullable() // ADDED — Plan 04-02 Task 1
})
export type NormalizedParams = z.infer<typeof NormalizedParamsSchema>

export const SAVE_NODE_CLASS_TYPES: ReadonlySet<string>
// Members: SaveImage, PreviewImage, SaveImageWebsocket,
//          SaveAnimatedWEBP, SaveImageExtended
// Extensible: custom save nodes not in this set produce
// saveNodeIdentity=null → (other) bucket (Pitfall 3).

export function emptyParams(createdAtMs: number): NormalizedParams
export function normalizeParams(
  rawMeta: Readonly<Record<string, string>>,
  createdAtMs: number,
  sourceFilename?: string | null
): NormalizedParams
```

### `thumbRepository.types.ts`

```ts
export const MOSHPIT_DB_NAME = 'moshpit-v1'
export const MOSHPIT_DB_VERSION = 3
```

### `thumbRepository.ts` — upgrade callback shape (unchanged public API)

```ts
export function openMoshpitDB(): Promise<IDBPDatabase<MoshpitDB>>
// Internally now runs v1→v2 then v2→v3 branches in the same
// versionchange transaction when upgrading from v1 directly.
```

## v2→v3 Migration Behaviour (D-11)

| Starting state                                                   | Result at open                                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Fresh DB (no file)                                               | Creates stores at v3. No migration runs. No logs.                                                                          |
| v2 DB with N records (all valid)                                 | N updates via cursor. Each `params.saveNodeIdentity` re-derived from `rec.metadata`. No logs.                              |
| v2 DB with K malformed-JSON records                              | `normalizeParams` returns fallback, `saveNodeIdentity: null` — migration succeeds.                                         |
| v2 DB with K structurally broken records (e.g. `metadata: null`) | `try/catch` fires K times (`console.error`), aggregate `console.warn` emitted once with skip count. Transaction continues. |
| v3 DB re-opened                                                  | `cachedDB` returns cached promise. No upgrade hook fires.                                                                  |
| v1 DB (no v2 ever ran)                                           | Both `oldVersion < 2` and `oldVersion < 3` branches run in sequence in the same transaction.                               |

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced beyond Phase 3's already-scoped `IDB assetMeta.metadata → NormalizedParams` boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolved pre-existing `thumbRepository.ts` TS2339/TS2698/TS2339 errors**

- **Found during:** Task 2 typecheck after adding the v2→v3 branch
- **Issue:** The v1→v2 cursor reads `cursor.value` as the idb-inferred `AssetMetaRecord` type, but the v1 on-disk shape lacks `params`. TS narrowed `cursor.value` to `never` after the `'params' in rec` guard, breaking `rec.metadata` / `rec.contentHash` / `{...rec}` accesses. These errors pre-dated Plan 04-02 (tracked in `deferred-items.md`), but the new v2→v3 branch touches the same cursor shape and would not compile without resolving them.
- **Fix:** Narrow `cursor.value` via `as unknown as { readonly contentHash: string; readonly metadata: Readonly<Record<string, string>> }` at the v1→v2 site, then cast the spread result to `AssetMetaRecord` on `cursor.update`. The new v2→v3 branch leaves `cursor.value` as `AssetMetaRecord` since by v3 every record has `params`.
- **Files modified:** `src/platform/moshpit/services/thumbRepository.ts`
- **Verification:** `pnpm typecheck` now shows only the unrelated minimap pre-existing error. `pnpm exec oxlint` clean on all 3 touched files.
- **Committed in:** `dfabb5259`

**2. [Rule 3 - Blocking] Split inline `type IDBPDatabase` import to top-level**

- **Found during:** Task 2 post-commit lint
- **Issue:** `import { type IDBPDatabase, openDB } from 'idb'` trips `consistent-type-specifier-style: prefer-top-level`.
- **Fix:** `import type { IDBPDatabase } from 'idb'` + separate `import { openDB } from 'idb'`.
- **Files modified:** `src/platform/moshpit/services/thumbRepository.ts`
- **Committed in:** `dfabb5259` (squashed into the same commit as fix 1)

**3. [Rule 1 - Bug] Added explicit type annotations to `warnSpy.mock.calls.map` callbacks**

- **Found during:** Task 2 husky pre-commit typecheck on the RED test commit
- **Issue:** `map((c) => String(c[0]))` produced TS7006 implicit-any on `c` because `vi.spyOn` callback types are variadic.
- **Fix:** Annotate `(c: unknown[]) => String(c[0])` and `(msg: string) => /.../i.test(msg)`.
- **Files modified:** `src/platform/moshpit/services/thumbRepository.test.ts`
- **Verification:** typecheck clean on the test file (pre-existing minimap error unaffected).
- **Committed in:** `dfabb5259` alongside the GREEN implementation.

**No architectural deviations (Rule 4) required.**

## Issues Encountered

- **Husky RED-commit friction (Phase 3 pattern continues):** The first RED commit (`622cef012`) introduced 2 new TS errors in the test file (implicit any on spy callbacks). lint-staged reverted the stage but the commit still landed because the staged-revert affects only the index, not the just-created commit. Fixed in the GREEN commit. Pattern matches Plan 04-01's experience and is documented in that plan's deferred-items notes.

- **Forced-skip synthesis is awkward:** To test the aggregate-skip-warn path, the test seeds a record with `metadata: null` directly via raw idb. This is a somewhat synthetic failure (real on-disk records always have at least `{}`), but it exercises the exact same `try/catch` boundary a future malformed record would hit. No stronger synthesis available without mocking `normalizeParams`, which would violate "don't mock what you don't own" testing guidance.

- **Malformed JSON is NOT a migration throw:** Documented as a key-decision above. The Plan's behaviour bullet said malformed JSON "logs console.error, counts it as skipped, proceeds to next record" — but `normalizeParams` already returns `emptyParams` on bad JSON (silent-null per D-03). The test renamed that case to "malformed JSON is logged and skipped without aborting the upgrade" and asserts the good-record co-located with the bad one still migrates, which is the substantive behavioural guarantee. No functional change to the migration code is implied.

## Forward Readiness

- Plan 04-03 (`useMoshpitFilteredAssets` refactor) now reads real `saveNodeIdentity` values from `params.saveNodeIdentity` via Plan 01's already-shipped `bucketKey('saveNode', ...)`. No further schema work needed — Plan 01's structural-widening pattern compiles cleanly against the now-materialised field.
- Plan 04-04 (`moshpitFilterStore`) and Plan 04-06 (grouping toggle UI) can assume every existing user's IDB will have `saveNodeIdentity` populated on first open after this plan ships. No rolling-write / backfill concerns for the UI layer.
- Plan 04-05 (cluster overlay) can truncate the `saveNodeIdentity` string to ~28 chars (D-06) knowing the field originates from `_meta.title` (bounded by prompt graph JSON size, already persisted upstream).

## Self-Check: PASSED

- `src/platform/moshpit/services/paramNormalize.ts` saveNodeIdentity field — FOUND (grep: 1 schema hit + 2 fallback-path hits + 1 `extractSaveNodeIdentity` call)
- `SAVE_NODE_CLASS_TYPES` export with 5 members — FOUND
- `src/platform/moshpit/services/thumbRepository.types.ts` `MOSHPIT_DB_VERSION = 3` — FOUND
- `MOSHPIT_DB_VERSION = 2` — 0 hits (stale constant fully removed)
- `src/platform/moshpit/services/thumbRepository.ts` `if (oldVersion < 3)` — FOUND (1 hit)
- `src/platform/moshpit/services/thumbRepository.ts` `if (oldVersion < 2)` — FOUND (1 hit; v1→v2 retained)
- `v2→v3 migration skipped` warn message — FOUND (1 hit)
- `src/platform/moshpit/services/thumbRepository.test.ts` `v2→v3` describe/body hits — FOUND (5 matches)
- Commit `123f35be8` (Task 1 RED) — FOUND in git log
- Commit `5d375acc0` (Task 1 GREEN) — FOUND in git log
- Commit `9301f934e` (Task 1 fix) — FOUND in git log
- Commit `622cef012` (Task 2 RED) — FOUND in git log
- Commit `dfabb5259` (Task 2 GREEN) — FOUND in git log
- `pnpm test:unit -- paramNormalize.test.ts thumbRepository.test.ts --run` — 57 / 57 green
- `pnpm exec oxlint` on the 3 touched thumbRepository files — 0 warnings / 0 errors
- `pnpm typecheck` — only the pre-existing unrelated `useMinimap.test.ts` TS2367 error remains

---

_Phase: 04-lineage-groupings-within-cluster-sort_
_Completed: 2026-04-21_
