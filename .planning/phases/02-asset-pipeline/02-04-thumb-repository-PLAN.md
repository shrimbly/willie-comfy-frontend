---
phase: 02-asset-pipeline
plan: 04
type: execute
wave: 1
depends_on: ['02-01']
files_modified:
  - src/platform/moshpit/services/thumbRepository.ts
  - src/platform/moshpit/services/thumbRepository.types.ts
autonomous: true
requirements: [ASSET-03, ASSET-04]
tags: [indexeddb, persistence, wave-1, tdd]
must_haves:
  truths:
    - 'IndexedDB database `moshpit-v1` version 1 is opened via `idb.openDB` with two object stores: `thumbs` (keyPath `contentHash`) and `assetMeta` (keyPath `contentHash`) — per RESEARCH §4'
    - '`putThumb`, `getThumb`, `getAllThumbHashes`, `putAssetMeta`, `getAssetMeta`, `defaultCuration`, `deleteMoshpitDB` are all reachable and behave per Wave-0 tests'
    - '`CurationRecord` is `{ favourite: boolean; tags: string[]; folders: string[]; hidden: boolean }` — the exact shape Phase 5 will mutate'
    - "Schema is explicit: `MoshpitDB` interface passed as the `openDB` generic so `db.put('thumbs', ...)` is type-checked, no `as any` anywhere"
    - 'All Wave-0 tests in `thumbRepository.test.ts` turn GREEN (fake-indexeddb driven)'
  artifacts:
    - path: 'src/platform/moshpit/services/thumbRepository.types.ts'
      provides: 'ThumbRecord, AssetMetaRecord, CurationRecord, MoshpitDB (idb schema)'
      contains: 'export interface MoshpitDB extends DBSchema'
    - path: 'src/platform/moshpit/services/thumbRepository.ts'
      provides: 'openMoshpitDB, putThumb, getThumb, getAllThumbHashes, putAssetMeta, getAssetMeta, defaultCuration, deleteMoshpitDB'
      contains: 'export async function putThumb'
  key_links:
    - from: 'src/platform/moshpit/services/thumbRepository.ts'
      to: 'idb (npm)'
      via: "import { openDB } from 'idb'"
      pattern: "import \\{ openDB"
---

<objective>
Implement the IndexedDB repository that backs ASSET-03 (thumbnail cache) and ASSET-04 (curation state). Two object stores, one database, `idb` v7 API with explicit schema types. Turn Wave-0 `thumbRepository.test.ts` GREEN.

Purpose: Single source of truth for all Moshpit persistence. Thumbnail blobs (evictable cache-like data) live in `thumbs`. Curation state (authoritative user-edited data) lives in `assetMeta`, keyed by the same content hash. Phase 5 will mutate `assetMeta.curation` without ever touching `thumbs`.

Output: Two files — a types file (exported interfaces) and a functions file (openDB + CRUD helpers). ~150 lines total.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-asset-pipeline/02-RESEARCH.md
@.planning/phases/02-asset-pipeline/02-CONTEXT.md

<interfaces>
Public API `src/platform/moshpit/services/thumbRepository.types.ts`:

```typescript
import type { DBSchema } from 'idb'

export interface CurationRecord {
  readonly favourite: boolean
  readonly tags: readonly string[]
  readonly folders: readonly string[]
  readonly hidden: boolean
}

export interface ThumbRecord {
  readonly contentHash: string
  readonly blob: Blob
  readonly width: number
  readonly height: number
  readonly generatedAt: number
}

export interface AssetMetaRecord {
  readonly contentHash: string
  readonly metadata: Readonly<Record<string, string>>
  readonly curation: CurationRecord
}

export interface MoshpitDB extends DBSchema {
  thumbs: { key: string; value: ThumbRecord }
  assetMeta: { key: string; value: AssetMetaRecord }
}
```

Public API `src/platform/moshpit/services/thumbRepository.ts`:

```typescript
export async function openMoshpitDB(): Promise<IDBPDatabase<MoshpitDB>>
export function defaultCuration(): CurationRecord
export async function putThumb(record: ThumbRecord): Promise<void>
export async function getThumb(
  contentHash: string
): Promise<ThumbRecord | undefined>
export async function getAllThumbHashes(): Promise<string[]>
export async function putAssetMeta(record: AssetMetaRecord): Promise<void>
export async function getAssetMeta(
  contentHash: string
): Promise<AssetMetaRecord | undefined>
/** Test-only helper; closes current handle and deletes the DB. */
export async function deleteMoshpitDB(): Promise<void>
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement thumbRepository — types + functions</name>
  <read_first>
    - src/platform/moshpit/services/thumbRepository.test.ts (Wave-0 RED tests)
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §4 IndexedDB Schema (exact shape)
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §2 IndexedDB Library (API surface)
    - vitest.setup.ts (confirm `fake-indexeddb/auto` is registered from Plan 01)
  </read_first>
  <behavior>
    - openMoshpitDB() returns an idb database handle typed `IDBPDatabase<MoshpitDB>`
    - First call creates the two stores via the `upgrade` callback
    - Subsequent calls (same tab) return the same cached handle
    - After `deleteMoshpitDB()`, the next `openMoshpitDB()` re-creates stores
    - putThumb({contentHash, blob, width, height, generatedAt}) persists across the next getThumb
    - getAllThumbHashes() returns an array of every stored `contentHash` string
    - defaultCuration() returns a new `CurationRecord` literal — no shared references
    - putAssetMeta + getAssetMeta round-trip the record verbatim
  </behavior>
  <action>
Create `src/platform/moshpit/services/thumbRepository.types.ts`:

```typescript
import type { DBSchema } from 'idb'

/** Phase 5 mutation target. Plain data — no methods. */
export interface CurationRecord {
  readonly favourite: boolean
  readonly tags: readonly string[]
  readonly folders: readonly string[]
  readonly hidden: boolean
}

export interface ThumbRecord {
  readonly contentHash: string
  readonly blob: Blob
  readonly width: number
  readonly height: number
  /** epoch ms — informational; used for future LRU/eviction (v2). */
  readonly generatedAt: number
}

export interface AssetMetaRecord {
  readonly contentHash: string
  /** Raw string key/value map from getFromPngBuffer — parsed JSON lives in the `workflow`/`prompt` fields per ComfyUI convention. */
  readonly metadata: Readonly<Record<string, string>>
  readonly curation: CurationRecord
}

/** idb typed schema — passed as generic to `openDB<MoshpitDB>`. */
export interface MoshpitDB extends DBSchema {
  thumbs: {
    key: string
    value: ThumbRecord
  }
  assetMeta: {
    key: string
    value: AssetMetaRecord
  }
}

export const MOSHPIT_DB_NAME = 'moshpit-v1'
export const MOSHPIT_DB_VERSION = 1
```

Create `src/platform/moshpit/services/thumbRepository.ts`:

```typescript
/**
 * IndexedDB repository for Moshpit's thumbnail cache (ASSET-03) and curation
 * state (ASSET-04). Content-hash addressed; shared across sessions.
 *
 * Two stores by design (RESEARCH §4):
 *   - `thumbs` — cache-like; evictable in v2. Holds WebP blobs.
 *   - `assetMeta` — authoritative user data; holds parsed ComfyUI metadata +
 *     curation record. Phase 5 curation mutations write here ONLY.
 *
 * This module is main-thread — the worker posts `thumbReady` messages and the
 * main thread handler calls `putThumb` + `putAssetMeta`. Keeping IDB off the
 * worker avoids having to open two handles into the same DB.
 */

import { type IDBPDatabase, openDB } from 'idb'

import type {
  AssetMetaRecord,
  CurationRecord,
  MoshpitDB,
  ThumbRecord
} from './thumbRepository.types'
import { MOSHPIT_DB_NAME, MOSHPIT_DB_VERSION } from './thumbRepository.types'

let cachedDB: Promise<IDBPDatabase<MoshpitDB>> | null = null

export function openMoshpitDB(): Promise<IDBPDatabase<MoshpitDB>> {
  if (cachedDB) return cachedDB
  cachedDB = openDB<MoshpitDB>(MOSHPIT_DB_NAME, MOSHPIT_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('thumbs')) {
        db.createObjectStore('thumbs', { keyPath: 'contentHash' })
      }
      if (!db.objectStoreNames.contains('assetMeta')) {
        db.createObjectStore('assetMeta', { keyPath: 'contentHash' })
      }
    },
    blocked() {
      console.warn(
        '[moshpit] IndexedDB upgrade blocked by another tab holding an older version'
      )
    },
    terminated() {
      // Browser killed the connection (quota? crash?). Next call re-opens.
      cachedDB = null
    }
  })
  return cachedDB
}

export function defaultCuration(): CurationRecord {
  return { favourite: false, tags: [], folders: [], hidden: false }
}

export async function putThumb(record: ThumbRecord): Promise<void> {
  const db = await openMoshpitDB()
  await db.put('thumbs', record)
}

export async function getThumb(
  contentHash: string
): Promise<ThumbRecord | undefined> {
  const db = await openMoshpitDB()
  return db.get('thumbs', contentHash)
}

export async function getAllThumbHashes(): Promise<string[]> {
  const db = await openMoshpitDB()
  const keys = await db.getAllKeys('thumbs')
  // keys are `string` by schema — safe by typed generic
  return keys
}

export async function putAssetMeta(record: AssetMetaRecord): Promise<void> {
  const db = await openMoshpitDB()
  await db.put('assetMeta', record)
}

export async function getAssetMeta(
  contentHash: string
): Promise<AssetMetaRecord | undefined> {
  const db = await openMoshpitDB()
  return db.get('assetMeta', contentHash)
}

/**
 * Test-only: closes the cached handle and deletes the DB. The next
 * `openMoshpitDB()` call will re-create stores from scratch.
 */
export async function deleteMoshpitDB(): Promise<void> {
  if (cachedDB) {
    const db = await cachedDB
    db.close()
    cachedDB = null
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(MOSHPIT_DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve() // treat blocked as best-effort clean
  })
}
```

Constraints:

- Use ONLY `idb` imports — no raw `IDBDatabase`.
- NO `any`, NO `as any`.
- The `blocked` and `terminated` callbacks are defensive; do not remove them.
- `deleteMoshpitDB` uses raw `indexedDB.deleteDatabase` because `idb` does not expose a typed delete-whole-DB helper — that is the one idiomatic raw usage. Typed via `Promise<void>`.
- No `export default`. All named exports.
  </action>
  <verify>
  <automated>pnpm test:unit --run src/platform/moshpit/services/thumbRepository.test.ts</automated>
  </verify>
  <acceptance_criteria> - `test -f src/platform/moshpit/services/thumbRepository.ts` exits 0 - `test -f src/platform/moshpit/services/thumbRepository.types.ts` exits 0 - `grep "interface MoshpitDB extends DBSchema" src/platform/moshpit/services/thumbRepository.types.ts` returns a match - `grep "createObjectStore('thumbs'" src/platform/moshpit/services/thumbRepository.ts` returns a match - `grep "createObjectStore('assetMeta'" src/platform/moshpit/services/thumbRepository.ts` returns a match - `grep -c "^export async function\|^export function" src/platform/moshpit/services/thumbRepository.ts` returns 7 (openMoshpitDB, defaultCuration, putThumb, getThumb, getAllThumbHashes, putAssetMeta, getAssetMeta, deleteMoshpitDB = 8; count may be 7 or 8 depending on async/non-async split) - `grep "as any\|: any" src/platform/moshpit/services/thumbRepository.ts` returns zero matches - `pnpm test:unit --run src/platform/moshpit/services/thumbRepository.test.ts` exits 0 with 3 tests passing - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Two object stores wired, 7 functions exported, Wave-0 tests GREEN.</done>
  </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                   | Description                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker → main thread → IDB | Worker posts blob + metadata; main thread writes to IDB. Untrusted inputs are the `metadata` record (parsed from PNG tEXt chunks — attacker-controllable if a user opens a malicious PNG) |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                 | Disposition | Mitigation Plan                                                                                                                                                                                                                                               |
| ---------- | ---------------------- | --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-02-04-01 | Information Disclosure | Cross-origin IDB leakage                                  | accept      | IndexedDB is origin-scoped per HTML spec; no cross-origin leakage possible. No third-party origins embedded in Moshpit. ASVS L1 V8.3.4.                                                                                                                       |
| T-02-04-02 | Denial of Service      | IDB quota exhaustion (250MB budget, 5k × ~50KB WebP)      | mitigate    | Budget documented in PROJECT.md constraints; v1 accepts unbounded growth and LRU is deferred to v2. `blocked` handler logs a warning so the user can be informed. Phase 7 perf validation will surface actual usage.                                          |
| T-02-04-03 | Tampering              | Malicious PNG metadata injected into `assetMeta.metadata` | mitigate    | `metadata` is typed `Readonly<Record<string, string>>` — no executable interpretation at the repository layer. Downstream filter (Phase 3) treats it as opaque strings. PNG parser runs in a Worker so any parsing crash cannot compromise main-thread state. |
| T-02-04-04 | Tampering              | Another tab holding an older DB version                   | accept      | `blocked` callback logs; user can close the other tab. v1 = single active tab by desktop-first assumption.                                                                                                                                                    |
| T-02-04-05 | Denial of Service      | zlib decompression bomb via `getFromPngBuffer`            | mitigate    | Parsing happens in the Worker, downstream of this repository. Worker-side `try/catch` (Plan 05) converts parse errors into `excluded` messages — the repository never sees a crash. Document in Plan 05.                                                      |

</threat_model>

<verification>
- `pnpm test:unit --run src/platform/moshpit/services/thumbRepository.test.ts` — 3 tests PASS (fake-indexeddb backed)
- `pnpm typecheck` exits 0
- `pnpm lint` on the new files exits 0
</verification>

<success_criteria>

- Two files: types + repository, both exported symbols present per interfaces
- fake-indexeddb round-trip tests PASS
- Zero `any` / `as any`
  </success_criteria>

<output>
Create `.planning/phases/02-asset-pipeline/02-04-SUMMARY.md` noting the MOSHPIT_DB_VERSION=1 contract (document the upgrade path for Phase 5 if it needs indexes).
</output>
