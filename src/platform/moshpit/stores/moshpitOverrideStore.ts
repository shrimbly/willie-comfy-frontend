import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Per-asset sprite-layer overrides keyed by contentHash. Currently tracks
 * pinned world position + scale; future sprite-control UIs (drag-to-pin,
 * resize handles, context menu "Reset to auto layout") mutate through this
 * store and the existing sprite-layer watchEffect re-applies the overrides.
 *
 * Every writer assigns a brand new Map so watchers tracking `records` (or
 * `records.size`) re-fire; record fields are `readonly` to keep consumers
 * honest about going through the store's mutation API.
 */
export interface OverrideRecord {
  readonly pinnedWorldPos?: { x: number; y: number }
  readonly scale?: number
  readonly pinnedAt: number
}

export const useMoshpitOverrideStore = defineStore('moshpitOverride', () => {
  const records = ref<Map<string, OverrideRecord>>(new Map())

  const size = computed(() => records.value.size)

  function get(hash: string): OverrideRecord | undefined {
    return records.value.get(hash)
  }

  function isPinned(hash: string): boolean {
    return !!records.value.get(hash)?.pinnedWorldPos
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
  }

  function clear(hash: string): void {
    if (!records.value.has(hash)) return
    const next = new Map(records.value)
    next.delete(hash)
    records.value = next
  }

  function clearAll(): void {
    if (records.value.size === 0) return
    records.value = new Map()
  }

  function reset(): void {
    clearAll()
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
    reset
  }
})
