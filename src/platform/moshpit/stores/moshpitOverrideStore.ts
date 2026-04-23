import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  clearAllOverrides,
  deleteOverride,
  loadAllOverrides,
  saveOverride
} from '../services/overrideRepository'

/**
 * Per-asset sprite-layer overrides keyed by contentHash. Currently tracks
 * pinned world position + scale; future sprite-control UIs (drag-to-pin,
 * resize handles, context menu "Reset to auto layout") mutate through this
 * store and the existing sprite-layer watchEffect re-applies the overrides.
 *
 * Every writer assigns a brand new Map so watchers tracking `records` (or
 * `records.size`) re-fire; record fields are `readonly` to keep consumers
 * honest about going through the store's mutation API.
 *
 * Persistence (Quick 260423-m6c): mutations schedule a 100ms-debounced write
 * to the IDB `overrides` store via `overrideRepository`. `hydrate()` seeds the
 * Map from IDB on Moshpit boot. Repository failures are swallowed with a
 * `console.warn` — persistence must never break in-memory behaviour.
 */
export interface OverrideRecord {
  readonly pinnedWorldPos?: { x: number; y: number }
  readonly scale?: number
  readonly pinnedAt: number
}

const PERSIST_DEBOUNCE_MS = 100

function logPersistError(err: unknown): void {
  console.warn('[moshpit] override persist failed', err)
}

export const useMoshpitOverrideStore = defineStore('moshpitOverride', () => {
  const records = ref<Map<string, OverrideRecord>>(new Map())
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const size = computed(() => records.value.size)

  function get(hash: string): OverrideRecord | undefined {
    return records.value.get(hash)
  }

  function isPinned(hash: string): boolean {
    return !!records.value.get(hash)?.pinnedWorldPos
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
      const current = records.value.get(hash)
      if (!current) {
        deleteOverride(hash).catch(logPersistError)
        return
      }
      saveOverride({
        contentHash: hash,
        pinnedWorldPos: current.pinnedWorldPos
          ? { x: current.pinnedWorldPos.x, y: current.pinnedWorldPos.y }
          : undefined,
        scale: current.scale,
        pinnedAt: current.pinnedAt
      }).catch(logPersistError)
    }, PERSIST_DEBOUNCE_MS)
    pendingTimers.set(hash, timer)
  }

  function setPin(hash: string, worldPos: { x: number; y: number }): void {
    const next = new Map(records.value)
    const existing = next.get(hash)
    next.set(hash, {
      scale: existing?.scale,
      pinnedWorldPos: { x: worldPos.x, y: worldPos.y },
      pinnedAt: Date.now()
    })
    records.value = next
    schedulePersist(hash)
  }

  function setScale(hash: string, scale: number): void {
    const next = new Map(records.value)
    const existing = next.get(hash)
    next.set(hash, {
      pinnedWorldPos: existing?.pinnedWorldPos,
      scale,
      pinnedAt: Date.now()
    })
    records.value = next
    schedulePersist(hash)
  }

  function unpin(hash: string): void {
    const existing = records.value.get(hash)
    if (!existing?.pinnedWorldPos) return
    const next = new Map(records.value)
    if (existing.scale === undefined) {
      next.delete(hash)
    } else {
      next.set(hash, {
        scale: existing.scale,
        pinnedAt: Date.now()
      })
    }
    records.value = next
    schedulePersist(hash)
  }

  function clearScale(hash: string): void {
    const existing = records.value.get(hash)
    if (existing?.scale === undefined) return
    const next = new Map(records.value)
    if (!existing.pinnedWorldPos) {
      next.delete(hash)
    } else {
      next.set(hash, {
        pinnedWorldPos: existing.pinnedWorldPos,
        pinnedAt: Date.now()
      })
    }
    records.value = next
    schedulePersist(hash)
  }

  function clear(hash: string): void {
    if (!records.value.has(hash)) return
    const next = new Map(records.value)
    next.delete(hash)
    records.value = next
    schedulePersist(hash)
  }

  function clearAll(): void {
    if (records.value.size === 0 && pendingTimers.size === 0) return
    for (const timer of pendingTimers.values()) {
      clearTimeout(timer)
    }
    pendingTimers.clear()
    records.value = new Map()
    clearAllOverrides().catch(logPersistError)
  }

  function reset(): void {
    clearAll()
  }

  async function hydrate(): Promise<void> {
    try {
      const persisted = await loadAllOverrides()
      const next = new Map<string, OverrideRecord>()
      for (const rec of persisted) {
        next.set(rec.contentHash, {
          pinnedWorldPos: rec.pinnedWorldPos
            ? { x: rec.pinnedWorldPos.x, y: rec.pinnedWorldPos.y }
            : undefined,
          scale: rec.scale,
          pinnedAt: rec.pinnedAt
        })
      }
      records.value = next
    } catch (err) {
      console.warn('[moshpit] override hydrate failed', err)
    }
  }

  return {
    records,
    size,
    get,
    isPinned,
    setPin,
    setScale,
    unpin,
    clearScale,
    clear,
    clearAll,
    reset,
    hydrate
  }
})
