import { defineStore } from 'pinia'
import { ref } from 'vue'

import {
  loadAllCurations,
  saveCuration,
  saveManyCurations
} from '@/platform/moshpit/services/curationRepository'
import type {
  AssetMetaRecord,
  CurationRecord
} from '@/platform/moshpit/services/thumbRepository.types'
import { defaultCuration } from '@/platform/moshpit/services/thumbRepository'

/**
 * Curation state keyed by content hash. Phase 2 shipped load/get/reset;
 * Phase 6 Plan 01 adds mutation actions (setFavourite, addTag, removeTag,
 * setHidden, addToFolder, removeFromFolder, applyManyOptimistic) with
 * debounced IDB persistence via curationRepository.
 *
 * Caps enforced at mutation time (T-06-01-02/03):
 *   - tag length: 64 chars (post-trim)
 *   - tag count: 50 per asset
 *
 * Every mutation assigns a new Map so Pinia watchers tracking curationByHash
 * re-fire (mirrors moshpitOverrideStore.setPin pattern).
 */

const TAG_MAX_LENGTH = 64
const TAG_MAX_COUNT = 50
const PERSIST_DEBOUNCE_MS = 100

function logPersistError(err: unknown): void {
  console.warn('[moshpit] curation persist failed', err)
}

export const useMoshpitCurationStore = defineStore('moshpitCuration', () => {
  const curationByHash = ref(new Map<string, CurationRecord>())
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function load(record: AssetMetaRecord): void {
    curationByHash.value.set(record.contentHash, record.curation)
  }

  function get(contentHash: string): CurationRecord | undefined {
    return curationByHash.value.get(contentHash)
  }

  function reset(): void {
    curationByHash.value.clear()
  }

  function cancelPending(hash: string): void {
    const timer = pendingTimers.get(hash)
    if (timer !== undefined) {
      clearTimeout(timer)
      pendingTimers.delete(hash)
    }
  }

  function schedulePersist(hash: string): void {
    cancelPending(hash)
    const timer = setTimeout(() => {
      pendingTimers.delete(hash)
      const current = curationByHash.value.get(hash) ?? defaultCuration()
      saveCuration(hash, current).catch(logPersistError)
    }, PERSIST_DEBOUNCE_MS)
    pendingTimers.set(hash, timer)
  }

  /**
   * Applies `updater` to the current CurationRecord for `hash` (defaults to
   * `defaultCuration()` if hash is unknown). Skips the Map swap if the record
   * is unchanged (shallow identity check). Schedules a debounced persist.
   *
   * Exception: removeTag on an unknown hash should be a pure no-op (no record
   * created). The caller is responsible for guarding before calling applyUpdate
   * when a no-op is expected for missing hashes.
   */
  function applyUpdate(
    hash: string,
    updater: (cur: CurationRecord) => CurationRecord,
    { skipIfMissing = false } = {}
  ): void {
    const current = curationByHash.value.get(hash)
    if (skipIfMissing && current === undefined) return
    const base = current ?? defaultCuration()
    const next = updater(base)
    if (next === base) return
    const map = new Map(curationByHash.value)
    map.set(hash, next)
    curationByHash.value = map
    schedulePersist(hash)
  }

  function setFavourite(hash: string, favourite: boolean): void {
    applyUpdate(hash, (cur) => {
      if (cur.favourite === favourite) return cur
      return { ...cur, favourite }
    })
  }

  function addTag(hash: string, rawTag: string): void {
    const tag = rawTag.trim()
    if (!tag) return
    if (tag.length > TAG_MAX_LENGTH) return
    applyUpdate(hash, (cur) => {
      if (cur.tags.length >= TAG_MAX_COUNT) return cur
      if (cur.tags.includes(tag)) return cur
      return { ...cur, tags: [...cur.tags, tag] }
    })
  }

  function removeTag(hash: string, tag: string): void {
    applyUpdate(
      hash,
      (cur) => {
        const next = cur.tags.filter((t) => t !== tag)
        if (next.length === cur.tags.length) return cur
        return { ...cur, tags: next }
      },
      { skipIfMissing: true }
    )
  }

  function setHidden(hash: string, hidden: boolean): void {
    applyUpdate(hash, (cur) => {
      if (cur.hidden === hidden) return cur
      return { ...cur, hidden }
    })
  }

  function addToFolder(hash: string, folderId: string): void {
    applyUpdate(hash, (cur) => {
      if (cur.folders.includes(folderId)) return cur
      return { ...cur, folders: [...cur.folders, folderId] }
    })
  }

  function removeFromFolder(hash: string, folderId: string): void {
    applyUpdate(
      hash,
      (cur) => {
        const next = cur.folders.filter((f) => f !== folderId)
        if (next.length === cur.folders.length) return cur
        return { ...cur, folders: next }
      },
      { skipIfMissing: true }
    )
  }

  async function applyManyOptimistic(
    updates: ReadonlyMap<string, CurationRecord>
  ): Promise<void> {
    // Cancel any pending per-hash timers to avoid double-write
    for (const hash of updates.keys()) {
      cancelPending(hash)
    }
    const next = new Map(curationByHash.value)
    for (const [hash, rec] of updates) {
      next.set(hash, rec)
    }
    curationByHash.value = next
    await saveManyCurations(updates).catch(logPersistError)
  }

  async function hydrate(): Promise<void> {
    try {
      const all = await loadAllCurations()
      const next = new Map(curationByHash.value)
      for (const [hash, curation] of all) {
        next.set(hash, curation)
      }
      curationByHash.value = next
    } catch (err) {
      console.warn('[moshpit] curation hydrate failed', err)
    }
  }

  return {
    curationByHash,
    load,
    get,
    reset,
    setFavourite,
    addTag,
    removeTag,
    setHidden,
    addToFolder,
    removeFromFolder,
    applyManyOptimistic,
    hydrate
  }
})
