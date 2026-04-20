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
 *   v2 — Phase 5 may add by-tag index on assetMeta for FILTER-07.
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
      // Browser killed the connection (quota exhaustion or crash).
      // Next call to openMoshpitDB() will re-open.
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
