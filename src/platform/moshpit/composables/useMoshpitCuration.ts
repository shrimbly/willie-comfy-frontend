import { ref } from 'vue'

import { t } from '@/i18n'
import { defaultCuration } from '@/platform/moshpit/services/thumbRepository'
import type { CurationRecord } from '@/platform/moshpit/services/thumbRepository.types'
import { useMoshpitCurationStore } from '@/platform/moshpit/stores/moshpitCurationStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

export const UNDO_WINDOW_MS = 8000
export const TAG_MAX_LENGTH = 64
export const TAGS_PER_ASSET_MAX = 50
export const FOLDER_NAME_MAX_LENGTH = 64

export interface UndoableAction {
  readonly id: string
  readonly label: string
  readonly expiresAt: number
  readonly undo: () => void | Promise<void>
}

export interface MoshpitCurationOptions {
  readonly resolveFullResUrl?: (hash: string) => string | null
}

// Module-level singleton ref so all callers share the same undo slot
// (mirrors the toastStore singleton pattern — composable-as-singleton).
const lastUndoable = ref<UndoableAction | null>(null)

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function useMoshpitCuration(options: MoshpitCurationOptions = {}) {
  const curationStore = useMoshpitCurationStore()
  const toastStore = useToastStore()

  function publishUndo(params: {
    label: string
    undo: () => void | Promise<void>
  }): void {
    const action: UndoableAction = {
      id: crypto.randomUUID(),
      label: params.label,
      expiresAt: Date.now() + UNDO_WINDOW_MS,
      undo: params.undo
    }
    lastUndoable.value = action
    toastStore.add({
      severity: 'info',
      summary: action.label,
      life: UNDO_WINDOW_MS,
      group: 'moshpit-curation'
    })
  }

  function undoLast(): boolean {
    const a = lastUndoable.value
    if (!a) return false
    if (Date.now() > a.expiresAt) {
      lastUndoable.value = null
      return false
    }
    void a.undo()
    lastUndoable.value = null
    toastStore.removeAll()
    return true
  }

  function favouriteMany(hashes: readonly string[], favourite = true): void {
    if (hashes.length === 0) return
    const prior = new Map<string, CurationRecord>()
    const next = new Map<string, CurationRecord>()
    for (const h of hashes) {
      const cur = curationStore.get(h) ?? defaultCuration()
      prior.set(h, cur)
      if (cur.favourite !== favourite) {
        next.set(h, { ...cur, favourite })
      }
    }
    if (next.size === 0) return

    void curationStore.applyManyOptimistic(next)

    if (hashes.length > 1) {
      const label = t(
        favourite
          ? 'moshpit.curation.favourited'
          : 'moshpit.curation.unfavourited',
        { count: next.size }
      )
      const priorSnapshot = new Map(prior)
      publishUndo({
        label,
        undo: () => {
          void curationStore.applyManyOptimistic(priorSnapshot)
        }
      })
    }
  }

  function tagMany(hashes: readonly string[], tag: string): void {
    if (hashes.length === 0) return
    const trimmed = tag.trim()
    if (!trimmed || trimmed.length > TAG_MAX_LENGTH) {
      toastStore.add({
        severity: 'warn',
        summary: t('moshpit.curation.invalidTag'),
        life: 3000
      })
      return
    }

    const prior = new Map<string, CurationRecord>()
    const next = new Map<string, CurationRecord>()
    for (const h of hashes) {
      const cur = curationStore.get(h) ?? defaultCuration()
      prior.set(h, cur)
      if (!cur.tags.includes(trimmed)) {
        next.set(h, { ...cur, tags: [...cur.tags, trimmed] })
      } else {
        // already has tag — still track in prior for undo, don't add to next
        prior.set(h, cur)
      }
    }
    if (next.size === 0) return

    void curationStore.applyManyOptimistic(next)

    const label = t('moshpit.curation.tagged', {
      count: next.size,
      tag: trimmed
    })
    const priorSnapshot = new Map(prior)
    publishUndo({
      label,
      undo: () => {
        void curationStore.applyManyOptimistic(priorSnapshot)
      }
    })
  }

  function untagMany(hashes: readonly string[], tag: string): void {
    if (hashes.length === 0) return

    const prior = new Map<string, CurationRecord>()
    const next = new Map<string, CurationRecord>()
    for (const h of hashes) {
      const cur = curationStore.get(h) ?? defaultCuration()
      prior.set(h, cur)
      if (cur.tags.includes(tag)) {
        next.set(h, { ...cur, tags: cur.tags.filter((t) => t !== tag) })
      }
    }
    if (next.size === 0) return

    void curationStore.applyManyOptimistic(next)

    const label = t('moshpit.curation.untagged', {
      count: next.size,
      tag
    })
    const priorSnapshot = new Map(prior)
    publishUndo({
      label,
      undo: () => {
        void curationStore.applyManyOptimistic(priorSnapshot)
      }
    })
  }

  function hideMany(hashes: readonly string[], hidden = true): void {
    if (hashes.length === 0) return
    const prior = new Map<string, CurationRecord>()
    const next = new Map<string, CurationRecord>()
    for (const h of hashes) {
      const cur = curationStore.get(h) ?? defaultCuration()
      prior.set(h, cur)
      if (cur.hidden !== hidden) {
        next.set(h, { ...cur, hidden })
      }
    }
    if (next.size === 0) return

    void curationStore.applyManyOptimistic(next)

    const label = t(
      hidden ? 'moshpit.curation.hidden' : 'moshpit.curation.unhidden',
      { count: next.size }
    )
    const priorSnapshot = new Map(prior)
    publishUndo({
      label,
      undo: () => {
        void curationStore.applyManyOptimistic(priorSnapshot)
      }
    })
  }

  function unhideMany(hashes: readonly string[]): void {
    hideMany(hashes, false)
  }

  function addToFolderMany(hashes: readonly string[], folderId: string): void {
    if (hashes.length === 0) return

    const prior = new Map<string, CurationRecord>()
    const next = new Map<string, CurationRecord>()
    for (const h of hashes) {
      const cur = curationStore.get(h) ?? defaultCuration()
      prior.set(h, cur)
      if (!cur.folders.includes(folderId)) {
        next.set(h, { ...cur, folders: [...cur.folders, folderId] })
      }
    }
    if (next.size === 0) return

    void curationStore.applyManyOptimistic(next)

    const label = t('moshpit.curation.addedToFolder', {
      count: next.size,
      folder: folderId
    })
    const priorSnapshot = new Map(prior)
    publishUndo({
      label,
      undo: () => {
        void curationStore.applyManyOptimistic(priorSnapshot)
      }
    })
  }

  function removeFromFolderMany(
    hashes: readonly string[],
    folderId: string
  ): void {
    if (hashes.length === 0) return

    const prior = new Map<string, CurationRecord>()
    const next = new Map<string, CurationRecord>()
    for (const h of hashes) {
      const cur = curationStore.get(h) ?? defaultCuration()
      prior.set(h, cur)
      if (cur.folders.includes(folderId)) {
        next.set(h, {
          ...cur,
          folders: cur.folders.filter((f) => f !== folderId)
        })
      }
    }
    if (next.size === 0) return

    void curationStore.applyManyOptimistic(next)

    const label = t('moshpit.curation.removedFromFolder', {
      count: next.size,
      folder: folderId
    })
    const priorSnapshot = new Map(prior)
    publishUndo({
      label,
      undo: () => {
        void curationStore.applyManyOptimistic(priorSnapshot)
      }
    })
  }

  function exportMany(hashes: readonly string[]): void {
    if (hashes.length === 0) return
    const resolver = options.resolveFullResUrl
    if (!resolver) {
      console.warn('[moshpit] exportMany called without resolveFullResUrl')
      return
    }
    let count = 0
    for (const h of hashes) {
      const url = resolver(h)
      if (!url) continue
      triggerDownload(url, `${h}.png`)
      count += 1
    }
    if (count > 0) {
      toastStore.add({
        severity: 'info',
        summary: t('moshpit.curation.exporting', { count }),
        life: 4000
      })
    }
  }

  return {
    favouriteMany,
    tagMany,
    untagMany,
    hideMany,
    unhideMany,
    addToFolderMany,
    removeFromFolderMany,
    exportMany,
    undoLast,
    lastUndoable
  }
}
