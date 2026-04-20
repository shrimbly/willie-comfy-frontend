/**
 * Sprite layer composable — ASSET-02 + ASSET-07 + ASSET-09.
 *
 * Owns:
 *   - A single PixiJS `Container` mounted under the `Viewport`
 *   - `Map<contentHash, Sprite>` for O(1) add/remove by registry diff
 *   - The jittered-grid (D-01) → packed-grid (D-04) transition tween
 *
 * Consumes (via `options`):
 *   - `viewport` + `ticker` — Pixi infrastructure owned by MoshpitCanvas
 *   - `queue: ProcessingQueueState` — THE SINGLE queue instance owned by
 *     MoshpitLayout. This composable MUST NOT call useMoshpitProcessingQueue()
 *     itself; doing so instantiates a second WorkerBridge and the `total/done`
 *     counters never tick, breaking the re-pack tween.
 *
 * Consumes (via composables — stateless reads of already-instantiated stores):
 *   - `useMoshpitAssetRegistry().entries` — reactive source of truth for
 *     which sprites should exist right now
 *   - `useMoshpitThumbStore().getUrl` — blob URL for a sprite texture; the
 *     watchEffect tracks this via reads inside `syncSprites`
 *
 * Reactivity contract:
 *   - `watchEffect(() => syncSprites(registry.entries.value))` — re-runs
 *     whenever ANY reactive dep read inside `syncSprites` mutates, including
 *     `thumbStore.urlByHash` (via `registry.entries.value[i].thumbUrl`) and
 *     `metaStore.assetIdToHash` (via the registry's OSS-path fallback).
 *     Do NOT use `watch(() => registry.entries.value.length, ...)` — it
 *     misses thumbReady events that don't change asset count.
 *
 * Texture configuration:
 *   - `autoGenerateMipmaps: true` — smooth LOD at far zoom
 *   - `autoGarbageCollect: true` — PixiJS may unload off-screen textures
 *   - Container `cullable: true` — skip off-screen sprites each frame
 *
 * Coordinate system: world-space (the Container lives under the Viewport, so
 * pan/zoom transforms the sprites automatically). `cellSize` is logical pixels.
 */

import { Container, ImageSource, Sprite, Texture } from 'pixi.js'
import type { Ticker } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { onBeforeUnmount, watch, watchEffect } from 'vue'

import type { ProcessingQueueState } from '@/platform/moshpit/composables/useMoshpitProcessingQueue'
import { useMoshpitAssetRegistry } from '@/platform/moshpit/composables/useMoshpitAssetRegistry'
import { layoutSeedHash } from '@/platform/moshpit/services/contentHash'
import type { GridSlot } from '@/platform/moshpit/services/layoutMath'
import {
  computeJitteredGrid,
  computePackedGrid
} from '@/platform/moshpit/services/layoutMath'

export const DEFAULT_CELL_SIZE = 560
export const REPACK_DURATION_MS = 300

export interface SpriteLayerOptions {
  readonly viewport: Viewport
  readonly ticker: Ticker
  /**
   * REQUIRED. The single ProcessingQueueState owned by MoshpitLayout.
   * Passing this in (rather than calling useMoshpitProcessingQueue() inside
   * the composable) avoids instantiating a second WorkerBridge. See revision
   * note iter 1 / Blocker 1.
   */
  readonly queue: ProcessingQueueState
  readonly cellSize?: number
}

interface SpriteEntry {
  readonly sprite: Sprite
  slot: GridSlot
}

export function useMoshpitSpriteLayer(
  options: SpriteLayerOptions
): { destroy(): void } {
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE
  const queue = options.queue
  const registry = useMoshpitAssetRegistry()

  const container = new Container()
  container.label = 'moshpit-sprites'
  container.cullable = true
  options.viewport.addChild(container)

  const spriteMap = new Map<string, SpriteEntry>()

  function computeLayoutSlots(hashes: readonly string[]): GridSlot[] {
    const sorted = [...hashes].sort()
    const seed = layoutSeedHash(queue.activeFilterId.value, sorted)
    return computeJitteredGrid(sorted, seed, cellSize)
  }

  function makeSprite(contentHash: string, thumbUrl: string): Sprite {
    const texture = Texture.from(thumbUrl)
    // Upgrade texture source options after Texture.from creates it. In Pixi v8
    // mipmaps default on for image resources; the explicit sets keep the
    // contract visible for future maintainers.
    if (texture.source instanceof ImageSource) {
      texture.source.autoGenerateMipmaps = true
      texture.source.autoGarbageCollect = true
    }
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.label = `moshpit-sprite:${contentHash}`
    return sprite
  }

  function applySlot(entry: SpriteEntry, slot: GridSlot): void {
    entry.slot = slot
    entry.sprite.x = slot.worldX
    entry.sprite.y = slot.worldY
  }

  function syncSprites(
    entries: readonly {
      readonly id: string
      readonly contentHash: string
      readonly thumbUrl: string | undefined
      readonly hasMetadata: boolean
    }[]
  ): void {
    const hashes = entries.map((e) => e.contentHash)
    const slots = computeLayoutSlots(hashes)
    const slotByHash = new Map(slots.map((s) => [s.hash, s]))

    // Remove sprites whose asset is no longer in the registry
    for (const [hash, entry] of spriteMap) {
      if (!slotByHash.has(hash)) {
        container.removeChild(entry.sprite)
        entry.sprite.destroy()
        spriteMap.delete(hash)
      }
    }

    // Add / update sprites. `entry.thumbUrl` is the reactive dep that makes
    // thumbReady events trigger this watchEffect.
    for (const entry of entries) {
      if (!entry.thumbUrl) continue
      const slot = slotByHash.get(entry.contentHash)
      if (!slot) continue
      const existing = spriteMap.get(entry.contentHash)
      if (!existing) {
        const sprite = makeSprite(entry.contentHash, entry.thumbUrl)
        const newEntry: SpriteEntry = { sprite, slot }
        applySlot(newEntry, slot)
        spriteMap.set(entry.contentHash, newEntry)
        container.addChild(sprite)
      } else {
        applySlot(existing, slot)
      }
    }
  }

  function startRepackTween(): void {
    const hashes = Array.from(spriteMap.keys()).sort()
    const packed = computePackedGrid(hashes, cellSize)
    const packedByHash = new Map(packed.map((p) => [p.hash, p]))
    const fromByHash = new Map<string, { x: number; y: number }>()
    for (const [hash, entry] of spriteMap) {
      fromByHash.set(hash, { x: entry.sprite.x, y: entry.sprite.y })
    }

    let elapsed = 0
    const handler = (ticker: Ticker) => {
      elapsed += ticker.deltaMS
      const t = Math.min(elapsed / REPACK_DURATION_MS, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out-cubic
      for (const [hash, entry] of spriteMap) {
        const to = packedByHash.get(hash)
        const from = fromByHash.get(hash)
        if (!to || !from) continue
        entry.sprite.x = from.x + (to.worldX - from.x) * eased
        entry.sprite.y = from.y + (to.worldY - from.y) * eased
      }
      if (t >= 1) {
        // Finalize slots
        for (const [hash, entry] of spriteMap) {
          const to = packedByHash.get(hash)
          if (to) entry.slot = to
        }
        options.ticker.remove(handler)
      }
    }
    options.ticker.add(handler)
  }

  // Watch registry for sprite add/remove/thumb-arrival.
  // watchEffect automatically tracks every reactive dep read inside the
  // callback, including `registry.entries.value[i].thumbUrl` (which reads
  // `thumbStore.urlByHash` via the computed chain), so progressive thumb
  // arrival triggers sync even when asset count is unchanged.
  const stopRegistryEffect = watchEffect(() => {
    syncSprites(registry.entries.value)
  })

  // Watch processing completion → fire re-pack tween once per completion
  let hasRepacked = false
  const stopCompletionWatch = watch(
    () => queue.total.value > 0 && queue.done.value === queue.total.value,
    (complete) => {
      if (complete && !hasRepacked) {
        hasRepacked = true
        startRepackTween()
      } else if (!complete) {
        hasRepacked = false
      }
    }
  )

  function destroy(): void {
    stopRegistryEffect()
    stopCompletionWatch()
    for (const [, entry] of spriteMap) {
      entry.sprite.destroy()
    }
    spriteMap.clear()
    container.destroy({ children: true })
  }

  onBeforeUnmount(destroy)

  return { destroy }
}
