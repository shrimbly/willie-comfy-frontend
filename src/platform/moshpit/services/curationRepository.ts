/**
 * IndexedDB repository for per-asset curation state (favourite, tags, folders,
 * hidden). Curation is stored as a nested field on AssetMetaRecord (ASSET-04
 * invariant: curation lives with metadata, not a separate store).
 *
 * Uses getMoshpitDB() — shared DB handle, do not open a second connection.
 * Callers (moshpitCurationStore) wrap every call in .catch(logPersistError) —
 * this module swallows nothing; errors propagate to the store layer.
 */

import { getMoshpitDB } from './thumbRepository'
import type { CurationRecord } from './thumbRepository.types'

/**
 * Updates the curation field on an existing AssetMetaRecord identified by
 * `hash`. If no assetMeta record exists for the hash, this is a silent no-op —
 * curation only persists when assetMeta exists (ASSET-04 invariant).
 */
export async function saveCuration(
  hash: string,
  curation: CurationRecord
): Promise<void> {
  const db = await getMoshpitDB()
  const existing = await db.get('assetMeta', hash)
  if (!existing) return
  await db.put('assetMeta', { ...existing, curation })
}

/**
 * Writes all [hash, curation] entries from `updates` in a single readwrite
 * transaction on `assetMeta`. Hashes without an existing assetMeta record are
 * silently skipped (same invariant as saveCuration).
 *
 * Use this for bulk mutations (e.g. favouriteMany) to avoid IDB write
 * amplification — a single transaction is cheaper than N debounced writes
 * (Pitfall 2 from Phase 6 research).
 */
export async function saveManyCurations(
  updates: ReadonlyMap<string, CurationRecord>
): Promise<void> {
  const db = await getMoshpitDB()
  const tx = db.transaction('assetMeta', 'readwrite')
  for (const [hash, curation] of updates) {
    const existing = await tx.store.get(hash)
    if (existing) {
      await tx.store.put({ ...existing, curation })
    }
  }
  await tx.done
}

/**
 * Returns a Map of contentHash → CurationRecord built from every record in the
 * assetMeta store. Used by moshpitCurationStore.hydrate().
 */
export async function loadAllCurations(): Promise<Map<string, CurationRecord>> {
  const db = await getMoshpitDB()
  const all = await db.getAll('assetMeta')
  const result = new Map<string, CurationRecord>()
  for (const record of all) {
    result.set(record.contentHash, record.curation)
  }
  return result
}
