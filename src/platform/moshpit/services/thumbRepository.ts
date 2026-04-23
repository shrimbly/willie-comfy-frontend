/**
 * IndexedDB repository for Moshpit's thumbnail cache (ASSET-03) and curation
 * state (ASSET-04). Content-hash addressed; shared across sessions.
 *
 * Two stores by design (RESEARCH §4):
 *   - `thumbs` — cache-like; evictable in v2. Holds WebP blobs.
 *   - `assetMeta` — authoritative user data; holds parsed ComfyUI metadata +
 *     curation record. Phase 5 curation mutations write here ONLY.
 *
 * DB version history:
 *   v1 — initial schema: thumbs + assetMeta, no indexes.
 *   v2 — Phase 3 Plan 04: assetMeta gains `params: NormalizedParams`.
 *         Upgrade callback re-parses params for all existing v1 records via
 *         normalizeParams (cursor-based, O(1) memory). See T-03-04-01 mitigation.
 *   v3 — Phase 4 Plan 02: params.saveNodeIdentity added (D-08 / D-11).
 *         Upgrade callback re-derives saveNodeIdentity from rec.metadata for
 *         every existing record; per-record try/catch + aggregate skip log
 *         (T-04-02-01 mitigation; Pitfall 4 — never throw from upgrade).
 */

import type { IDBPDatabase } from 'idb'
import { openDB } from 'idb'

import type { NormalizedParams } from './paramNormalize'
import { normalizeParams } from './paramNormalize'
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
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (!db.objectStoreNames.contains('thumbs')) {
        db.createObjectStore('thumbs', { keyPath: 'contentHash' })
      }
      if (!db.objectStoreNames.contains('assetMeta')) {
        db.createObjectStore('assetMeta', { keyPath: 'contentHash' })
      }
      // v1 → v2: retroactively populate `params` on existing assetMeta records.
      // Cursor-based streaming keeps memory O(1) regardless of record count.
      // T-03-04-01: try/catch per record — a single malformed record is skipped
      // rather than aborting the entire upgrade transaction.
      if (oldVersion < 2) {
        const store = tx.objectStore('assetMeta')
        let cursor = await store.openCursor()
        while (cursor) {
          // Cursor value at v1 is a legacy shape (no `params`), not AssetMetaRecord.
          // Read as `unknown` then narrow the shape we actually touch.
          const rec = cursor.value as unknown as {
            readonly contentHash: string
            readonly metadata: Readonly<Record<string, string>>
          }
          if (!('params' in (rec as object))) {
            try {
              const params = normalizeParams(rec.metadata, Date.now())
              await cursor.update({
                ...(rec as object),
                params
              } as AssetMetaRecord)
            } catch (err) {
              // Belt-and-braces: if a single record's metadata is malformed,
              // skip it — its next write will populate params correctly.
              console.error(
                '[moshpit] v1→v2 migration failed for record',
                rec.contentHash,
                err
              )
            }
          }
          cursor = await cursor.continue()
        }
      }
      // v2 → v3: re-derive saveNodeIdentity on every assetMeta record from its
      // already-stored rec.metadata. Cursor-based streaming; per-record
      // try/catch with an aggregate skip counter surfaced via console.warn
      // at the end (T-04-02-01; Pitfall 4 — never throw from upgrade).
      if (oldVersion < 3) {
        const store = tx.objectStore('assetMeta')
        let cursor = await store.openCursor()
        let skipped = 0
        while (cursor) {
          const rec = cursor.value
          try {
            const fresh = normalizeParams(
              rec.metadata,
              rec.params?.timestamp ?? Date.now()
            )
            const nextParams: NormalizedParams = rec.params
              ? { ...rec.params, saveNodeIdentity: fresh.saveNodeIdentity }
              : fresh
            await cursor.update({ ...rec, params: nextParams })
          } catch (err) {
            skipped += 1
            console.error(
              '[moshpit] v2→v3 migration failed for record',
              rec.contentHash,
              err
            )
          }
          cursor = await cursor.continue()
        }
        if (skipped > 0) {
          console.warn(`[moshpit] v2→v3 migration skipped ${skipped} records`)
        }
      }
      // v3 → v4: add the `overrides` object store for persisting
      // moshpitOverrideStore records (pinned world positions + manual scales).
      // No data migration needed — the in-memory override store is populated
      // by user action after hydration, so pre-v4 users simply start empty.
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('overrides')) {
          db.createObjectStore('overrides', { keyPath: 'contentHash' })
        }
      }
      // v4 → v5 (Phase 6 Plan 01): add the `folders` object store for
      // user-defined folder metadata (id/name/createdAt). Keyed by folder id
      // (uuid). CurationRecord.folders[] holds folder ids that reference this
      // store. No per-record migration — pre-v5 data has folders: []
      // universally (no Phase 6 UI existed). Dangling folder ids (should they
      // somehow exist) become inert references on read — harmless.
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' })
        }
      }
    },
    blocked() {
      console.warn(
        '[moshpit] IndexedDB upgrade blocked by another tab holding an older version'
      )
    },
    terminated() {
      // Browser killed the connection (quota exhaustion or crash).
      // Next call to openMoshpitDB() will re-open.
      cachedDB = null
    }
  })
  return cachedDB
}

/**
 * Shared accessor for the MoshpitDB connection. Used by sibling repositories
 * (e.g. `overrideRepository.ts`) so a single `openDB` handle is reused across
 * all stores. Calling this before any thumb/meta operation is safe — it
 * delegates to `openMoshpitDB()`.
 */
export function getMoshpitDB(): Promise<IDBPDatabase<MoshpitDB>> {
  return openMoshpitDB()
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
  // getAllKeys returns IDBValidKey[] typed as string[] by the MoshpitDB schema
  return db.getAllKeys('thumbs')
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
 *
 * Uses raw `indexedDB.deleteDatabase` because `idb` does not expose a
 * typed delete-whole-DB helper — this is the one idiomatic raw usage.
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
    // Treat blocked as best-effort clean — another tab holds the DB open.
    req.onblocked = () => resolve()
  })
}
