import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  clearAllFolders,
  deleteFolder,
  loadAllFolders,
  saveFolder
} from '@/platform/moshpit/services/foldersRepository'
import type { FolderRecord } from '@/platform/moshpit/services/thumbRepository.types'

import { useMoshpitCurationStore } from './moshpitCurationStore'

/**
 * User-defined folder management for Moshpit curation.
 *
 * Folders are metadata-only (id, name, createdAt) — the association between
 * an asset and a folder lives in CurationRecord.folders[] as folder ids.
 * Renaming is O(1) because assets reference ids, not names.
 *
 * Caps enforced (T-06-01-02):
 *   - folder count: 200 total. create() returns '' on cap hit so callers
 *     can detect and show a toast (Plan 03 orchestrator handles UI feedback).
 *
 * Persistence: 100ms debounced writes via foldersRepository. Failures are
 * logged via console.warn and never break in-memory behaviour.
 *
 * Referential integrity: remove() scrubs deleted folder ids from every
 * CurationRecord.folders[] in moshpitCurationStore BEFORE deleting the
 * FolderRecord (Pitfall 4 from Phase 6 research).
 */

const FOLDER_MAX_COUNT = 200
const PERSIST_DEBOUNCE_MS = 100

function logPersistError(err: unknown): void {
  console.warn('[moshpit] folder persist failed', err)
}

export const useMoshpitFoldersStore = defineStore('moshpitFolders', () => {
  const folders = ref<Map<string, FolderRecord>>(new Map())
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const orderedFolders = computed(() =>
    [...folders.value.values()].sort((a, b) => a.createdAt - b.createdAt)
  )

  function cancelPending(id: string): void {
    const timer = pendingTimers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      pendingTimers.delete(id)
    }
  }

  function schedulePersist(id: string): void {
    cancelPending(id)
    const timer = setTimeout(() => {
      pendingTimers.delete(id)
      const current = folders.value.get(id)
      if (!current) {
        deleteFolder(id).catch(logPersistError)
        return
      }
      saveFolder(current).catch(logPersistError)
    }, PERSIST_DEBOUNCE_MS)
    pendingTimers.set(id, timer)
  }

  async function hydrate(): Promise<void> {
    try {
      const persisted = await loadAllFolders()
      const next = new Map<string, FolderRecord>()
      for (const record of persisted) {
        next.set(record.id, record)
      }
      folders.value = next
    } catch (err) {
      console.warn('[moshpit] folder hydrate failed', err)
    }
  }

  /**
   * Creates a new folder with the given name. Returns the new folder's uuid,
   * or '' if the folder count cap (200) has been reached.
   */
  function create(name: string): string {
    if (folders.value.size >= FOLDER_MAX_COUNT) return ''
    const id = crypto.randomUUID()
    const record: FolderRecord = { id, name, createdAt: Date.now() }
    const next = new Map(folders.value)
    next.set(id, record)
    folders.value = next
    schedulePersist(id)
    return id
  }

  function rename(id: string, name: string): void {
    const existing = folders.value.get(id)
    if (!existing) return
    const next = new Map(folders.value)
    next.set(id, { ...existing, name })
    folders.value = next
    schedulePersist(id)
  }

  /**
   * Removes a folder by id. Scrubs the folder id from every CurationRecord
   * in moshpitCurationStore before deleting (Pitfall 4 — dangling references).
   */
  function remove(id: string): void {
    const curationStore = useMoshpitCurationStore()
    // Scrub folder id from all curation records before deleting
    for (const [hash, curation] of curationStore.curationByHash) {
      if (curation.folders.includes(id)) {
        curationStore.removeFromFolder(hash, id)
      }
    }
    cancelPending(id)
    const next = new Map(folders.value)
    next.delete(id)
    folders.value = next
    deleteFolder(id).catch(logPersistError)
  }

  /**
   * Creates a folder and adds all given asset hashes to it via
   * curationStore.addToFolder. Returns the new folder's uuid.
   */
  function createFromSelection(
    name: string,
    hashes: readonly string[]
  ): string {
    const id = create(name)
    if (!id) return id
    const curationStore = useMoshpitCurationStore()
    for (const hash of hashes) {
      curationStore.addToFolder(hash, id)
    }
    return id
  }

  function clearAll(): void {
    for (const timer of pendingTimers.values()) {
      clearTimeout(timer)
    }
    pendingTimers.clear()
    folders.value = new Map()
    clearAllFolders().catch(logPersistError)
  }

  return {
    folders,
    orderedFolders,
    hydrate,
    create,
    rename,
    remove,
    createFromSelection,
    clearAll
  }
})
