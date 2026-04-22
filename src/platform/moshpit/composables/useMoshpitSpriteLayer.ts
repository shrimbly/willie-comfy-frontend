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

import { Container, Graphics, ImageSource, Sprite, Texture } from 'pixi.js'
import type { Ticker } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import type { InjectionKey } from 'vue'
import { onBeforeUnmount, watchEffect } from 'vue'

import type { ProcessingQueueState } from '@/platform/moshpit/composables/useMoshpitProcessingQueue'
import { useMoshpitAssetRegistry } from '@/platform/moshpit/composables/useMoshpitAssetRegistry'
import type { SpriteHitRect } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { layoutSeedHash } from '@/platform/moshpit/services/contentHash'
import type { GridSlot } from '@/platform/moshpit/services/layoutMath'
import { computeJitteredGrid } from '@/platform/moshpit/services/layoutMath'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'

export const DEFAULT_CELL_SIZE = 560

/**
 * Injection key for passing the Phase 3 filtered-assets layout provider from
 * MoshpitLayout (where useMoshpitFilteredAssets is instantiated) down to
 * MoshpitCanvas (where useMoshpitSpriteLayer is instantiated). This avoids
 * prop-drilling through MoshpitView and keeps the layout provider co-located
 * with the SpriteLayerOptions type it feeds.
 */
export const MOSHPIT_LAYOUT_INJECTION_KEY: InjectionKey<
  () => readonly GridSlot[]
> = Symbol('moshpit:layoutProvider')

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
  /**
   * Phase 3: if provided, called inside the registry watchEffect to supply
   * external layout targets. When absent, the composable falls back to the
   * Phase 2 jittered-grid `computeLayoutSlots` path.
   *
   * Must be a pure function returning one GridSlot per currently-visible
   * contentHash. Re-invoked on every reactive dep read inside the function.
   */
  readonly layoutProvider?: () => readonly GridSlot[]
}

interface SpriteEntry {
  readonly sprite: Sprite
  slot: GridSlot
}

export interface SpriteLayerHandle {
  destroy(): void
  /** Returns the top-most asset hash whose sprite AABB contains the world point, or null. */
  hitTestPoint(worldX: number, worldY: number): string | null
  /** Returns every asset hash whose sprite AABB intersects the world rect. */
  hitTestRect(rect: SpriteHitRect): string[]
}

export function useMoshpitSpriteLayer(
  options: SpriteLayerOptions
): SpriteLayerHandle {
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE
  const queue = options.queue
  const registry = useMoshpitAssetRegistry()
  const selection = useMoshpitSelectionStore()

  const container = new Container()
  container.label = 'moshpit-sprites'
  container.cullable = true
  options.viewport.addChild(container)

  // Selection rings live in a separate container above the sprite container so
  // they render on top regardless of sprite draw order. Parented to the same
  // viewport so world-space pan/zoom applies uniformly.
  const selectionRings = new Container()
  selectionRings.label = 'moshpit-selection-rings'
  selectionRings.cullable = true
  options.viewport.addChild(selectionRings)

  const spriteMap = new Map<string, SpriteEntry>()
  const ringMap = new Map<string, Graphics>()
  let cancelled = false

  function computeLayoutSlots(hashes: readonly string[]): GridSlot[] {
    if (options.layoutProvider) {
      return [...options.layoutProvider()]
    }
    const sorted = [...hashes].sort()
    const seed = layoutSeedHash(queue.activeFilterId.value, sorted)
    return computeJitteredGrid(sorted, seed, cellSize)
  }

  // Blob URLs have no file extension, so Pixi's Assets.load can't pick a
  // parser for them. Decode via HTMLImageElement + Texture.from(element) —
  // that path skips Pixi's extension sniffer entirely.
  async function loadTexture(thumbUrl: string): Promise<Texture | null> {
    try {
      const img = new Image()
      img.src = thumbUrl
      await img.decode()
      const texture = Texture.from(img)
      if (texture.source && texture.source instanceof ImageSource) {
        texture.source.autoGenerateMipmaps = true
        texture.source.autoGarbageCollect = true
      }
      return texture
    } catch (err) {
      console.warn('[moshpit] texture load failed', thumbUrl, err)
      return null
    }
  }

  function makeSpriteFromTexture(
    contentHash: string,
    texture: Texture
  ): Sprite {
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.label = `moshpit-sprite:${contentHash}`
    return sprite
  }

  // Hashes currently being loaded — prevents duplicate Assets.load calls
  // when syncSprites fires again before the first load resolves.
  const pendingLoads = new Set<string>()

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
      if (existing) {
        applySlot(existing, slot)
        continue
      }
      if (pendingLoads.has(entry.contentHash)) continue
      pendingLoads.add(entry.contentHash)
      const hash = entry.contentHash
      const url = entry.thumbUrl
      void loadTexture(url).then((texture) => {
        pendingLoads.delete(hash)
        if (!texture) return
        // Sprite layer may have been torn down (cancelled) or the entry
        // removed from the registry while the texture was loading.
        if (cancelled) return
        if (spriteMap.has(hash)) return
        const latestSlot = slotByHash.get(hash)
        if (!latestSlot) return
        const sprite = makeSpriteFromTexture(hash, texture)
        const newEntry: SpriteEntry = { sprite, slot: latestSlot }
        applySlot(newEntry, latestSlot)
        spriteMap.set(hash, newEntry)
        container.addChild(sprite)
      })
    }
  }

  // Watch registry for sprite add/remove/thumb-arrival.
  // watchEffect automatically tracks every reactive dep read inside the
  // callback, including `registry.entries.value[i].thumbUrl` (which reads
  // `thumbStore.urlByHash` via the computed chain), so progressive thumb
  // arrival triggers sync even when asset count is unchanged.
  //
  // The injected `layoutProvider` (from useMoshpitFilteredAssets) is the
  // single source of truth for sprite positions — its cluster layout
  // already sorts by `withinClusterSort`, so there is no post-completion
  // repack: sprites land on their final slots as soon as their hash enters
  // the layout, and nothing moves them after that.
  const stopRegistryEffect = watchEffect(() => {
    syncSprites(registry.entries.value)
  })

  function drawRing(entry: SpriteEntry): Graphics {
    const g = new Graphics()
    const w = entry.sprite.width || cellSize
    const h = entry.sprite.height || cellSize
    const thickness = Math.max(4, Math.min(w, h) * 0.03)
    g.rect(-w / 2, -h / 2, w, h).stroke({
      width: thickness,
      color: 0x4f9eff,
      alpha: 1,
      alignment: 0.5
    })
    g.x = entry.slot.worldX
    g.y = entry.slot.worldY
    return g
  }

  // Sync selection rings on every selection change AND whenever sprites
  // re-layout (registry effect above may reassign slots or swap textures).
  // watchEffect tracks `selection.selected` and reads from spriteMap — the
  // sprite entries are not reactive, so we re-run from the registry effect
  // too via `syncSprites` (which implicitly triggers a microtask).
  const stopSelectionEffect = watchEffect(() => {
    const ids = new Set(selection.selected)
    for (const [hash, ring] of ringMap) {
      if (!ids.has(hash)) {
        selectionRings.removeChild(ring)
        ring.destroy()
        ringMap.delete(hash)
      }
    }
    for (const hash of ids) {
      const entry = spriteMap.get(hash)
      if (!entry) continue
      const existing = ringMap.get(hash)
      if (existing) {
        existing.x = entry.slot.worldX
        existing.y = entry.slot.worldY
        continue
      }
      const ring = drawRing(entry)
      ringMap.set(hash, ring)
      selectionRings.addChild(ring)
    }
  })

  function hitTestPoint(worldX: number, worldY: number): string | null {
    // Iterate in reverse child order so the top-most sprite wins on overlap.
    const children = container.children
    for (let i = children.length - 1; i >= 0; i--) {
      const sprite = children[i]
      if (!(sprite instanceof Sprite)) continue
      const halfW = sprite.width / 2
      const halfH = sprite.height / 2
      if (
        worldX >= sprite.x - halfW &&
        worldX <= sprite.x + halfW &&
        worldY >= sprite.y - halfH &&
        worldY <= sprite.y + halfH
      ) {
        for (const [hash, entry] of spriteMap) {
          if (entry.sprite === sprite) return hash
        }
      }
    }
    return null
  }

  function hitTestRect(rect: SpriteHitRect): string[] {
    const hits: string[] = []
    for (const [hash, entry] of spriteMap) {
      const sprite = entry.sprite
      const halfW = sprite.width / 2
      const halfH = sprite.height / 2
      const left = sprite.x - halfW
      const right = sprite.x + halfW
      const top = sprite.y - halfH
      const bottom = sprite.y + halfH
      if (
        right >= rect.left &&
        left <= rect.right &&
        bottom >= rect.top &&
        top <= rect.bottom
      ) {
        hits.push(hash)
      }
    }
    return hits
  }

  function destroy(): void {
    cancelled = true
    stopSelectionEffect()
    stopRegistryEffect()
    for (const [, entry] of spriteMap) {
      entry.sprite.destroy()
    }
    spriteMap.clear()
    for (const [, ring] of ringMap) {
      ring.destroy()
    }
    ringMap.clear()
    selectionRings.destroy({ children: true })
    container.destroy({ children: true })
  }

  onBeforeUnmount(destroy)

  return { destroy, hitTestPoint, hitTestRect }
}
