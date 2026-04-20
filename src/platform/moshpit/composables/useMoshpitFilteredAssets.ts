/**
 * Filter + sort pipeline (Phase 3). Sits between the registry (Phase 2) and
 * the sprite layer:
 *
 *   useMoshpitAssetRegistry     (all assets with thumbs)
 *              │
 *              ▼
 *   useMoshpitFilteredAssets    ← applyFilterChips → then sortMath (or jittered)
 *              │
 *              ▼
 *   useMoshpitSpriteLayer       (tween to target positions)
 *
 * Performance contract: the core filter+sort computation is a single O(N)
 * pass per reactive change. Params / curation maps are already in memory
 * (moshpitMetadataStore / moshpitCurationStore), so no IDB reads occur on
 * filter or sort mutations.
 */

import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import { applyFilterChips } from '../services/filterMath'
import type { GridSlot } from '../services/layoutMath'
import { computeJitteredGrid } from '../services/layoutMath'
import { layoutSeedHash } from '../services/contentHash'
import type { ColumnDescriptor, RowDescriptor } from '../services/sortMath'
import {
  computeSortedLayout1D,
  computeSortedLayout2D
} from '../services/sortMath'
import { useMoshpitCurationStore } from '../stores/moshpitCurationStore'
import { useMoshpitFilterStore } from '../stores/moshpitFilterStore'
import { useMoshpitMetadataStore } from '../stores/moshpitMetadataStore'
import { useMoshpitAssetRegistry } from './useMoshpitAssetRegistry'

export interface FilteredAssetEntry {
  readonly id: string
  readonly contentHash: string
  readonly thumbUrl: string | undefined
  readonly worldX: number
  readonly worldY: number
}

interface LayoutResult {
  readonly visible: readonly string[]
  readonly slotByHash: ReadonlyMap<string, GridSlot>
  readonly columns: readonly ColumnDescriptor[]
  readonly rows: readonly RowDescriptor[]
}

const EMPTY_LAYOUT: LayoutResult = {
  visible: [],
  slotByHash: new Map(),
  columns: [],
  rows: []
}

export function useMoshpitFilteredAssets(): {
  readonly entries: ComputedRef<readonly FilteredAssetEntry[]>
  readonly columns: ComputedRef<readonly ColumnDescriptor[]>
  readonly rows: ComputedRef<readonly RowDescriptor[]>
  readonly axisMode: ComputedRef<'chaos' | '1d' | '2d'>
} {
  const registry = useMoshpitAssetRegistry()
  const metaStore = useMoshpitMetadataStore()
  const curationStore = useMoshpitCurationStore()
  const filterStore = useMoshpitFilterStore()

  const axisMode = computed<'chaos' | '1d' | '2d'>(() => {
    if (filterStore.sortX === null) return 'chaos'
    if (filterStore.sortY === null) return '1d'
    return '2d'
  })

  // The core computation: post-filter visible hash list + layout target map.
  const layout = computed<LayoutResult>(() => {
    if (!filterStore.isGated) return EMPTY_LAYOUT

    const allEntries = registry.entries.value
    const hashToParams = metaStore.paramsByHash
    const visibleHashes = allEntries.map((e) => e.contentHash)

    // Build curation map scoped to registry hashes
    const hashToCuration = new Map(
      visibleHashes.flatMap((h) => {
        const rec = curationStore.get(h)
        return rec ? [[h, rec] as const] : []
      })
    )

    // Filter: applyFilterChips returns only hashes that pass all predicates
    const filtered = applyFilterChips(
      hashToParams,
      hashToCuration,
      filterStore.chips,
      filterStore.showHidden,
      filterStore.timeRange,
      Date.now()
    )

    // Intersect with registry (applyFilterChips walks paramsByHash which may
    // include hashes not yet in the registry — keep only what's visible)
    const registrySet = new Set(visibleHashes)
    const visible = filtered.filter((h) => registrySet.has(h))

    // Sort layout
    if (filterStore.sortX !== null && filterStore.sortY !== null) {
      const { slots, columns, rows } = computeSortedLayout2D(
        visible,
        hashToParams,
        filterStore.sortX,
        filterStore.sortY,
        filterStore.gridSpacing
      )
      return {
        visible: slots.map((s) => s.hash),
        slotByHash: new Map(slots.map((s) => [s.hash, s])),
        columns,
        rows
      }
    }

    if (filterStore.sortX !== null) {
      const { slots, columns } = computeSortedLayout1D(
        visible,
        hashToParams,
        filterStore.sortX,
        filterStore.gridSpacing
      )
      return {
        visible: slots.map((s) => s.hash),
        slotByHash: new Map(slots.map((s) => [s.hash, s])),
        columns,
        rows: []
      }
    }

    // Chaos: jittered grid (D-01/D-02/D-19)
    const sortedHashes = [...visible].sort()
    const seed = layoutSeedHash('filtered', sortedHashes)
    const chaos = computeJitteredGrid(sortedHashes, seed, filterStore.gridSpacing)
    return {
      visible: sortedHashes,
      slotByHash: new Map(chaos.map((s) => [s.hash, s])),
      columns: [],
      rows: []
    }
  })

  const entries = computed<readonly FilteredAssetEntry[]>(() => {
    const src = registry.entries.value
    const { slotByHash } = layout.value
    const out: FilteredAssetEntry[] = []
    for (const e of src) {
      const slot = slotByHash.get(e.contentHash)
      if (!slot) continue
      out.push({
        id: e.id,
        contentHash: e.contentHash,
        thumbUrl: e.thumbUrl,
        worldX: slot.worldX,
        worldY: slot.worldY
      })
    }
    return out
  })

  const columns = computed(() => layout.value.columns)
  const rows = computed(() => layout.value.rows)

  return { entries, columns, rows, axisMode }
}
