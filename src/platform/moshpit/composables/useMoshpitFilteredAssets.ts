/**
 * Filter + cluster-layout pipeline (Phase 4). Sits between the registry
 * (Phase 2) and the sprite layer:
 *
 *   useMoshpitAssetRegistry     (all assets with thumbs)
 *              │
 *              ▼
 *   useMoshpitFilteredAssets    ← applyFilterChips → computeClusterLayout
 *              │
 *              ▼
 *   useMoshpitSpriteLayer       (tween to target positions)
 *
 * Performance contract: the core filter+layout computation is a single
 * reactive pass per change. Params / curation maps are already in memory
 * (moshpitMetadataStore / moshpitCurationStore), so no IDB reads occur on
 * filter or grouping mutations. `computeClusterLayout` memoises bucket keys
 * internally (<100ms at 5k × 3 axes per Plan 01 perf marker).
 */

import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import { applyFilterChips } from '../services/filterMath'
import type { ClusterNode } from '../services/clusterLayout'
import {
  computeClusterLayout,
  computeNestingOrder
} from '../services/clusterLayout'
import type { GroupingAxis } from '../services/groupAxes'
import type { GridSlot } from '../services/layoutMath'
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
  readonly slotByHash: ReadonlyMap<string, GridSlot>
  readonly clusterTree: ClusterNode | null
  readonly nestingOrder: readonly GroupingAxis[]
}

const EMPTY_LAYOUT: LayoutResult = {
  slotByHash: new Map(),
  clusterTree: null,
  nestingOrder: []
}

export function useMoshpitFilteredAssets(): {
  readonly entries: ComputedRef<readonly FilteredAssetEntry[]>
  readonly clusterTree: ComputedRef<ClusterNode | null>
  readonly activeGroupingOrder: ComputedRef<readonly GroupingAxis[]>
} {
  const registry = useMoshpitAssetRegistry()
  const metaStore = useMoshpitMetadataStore()
  const curationStore = useMoshpitCurationStore()
  const filterStore = useMoshpitFilterStore()

  const layout = computed<LayoutResult>(() => {
    if (!filterStore.isGated) return EMPTY_LAYOUT

    const allEntries = registry.entries.value
    const hashToParams = metaStore.paramsByHash
    const visibleHashes = allEntries.map((e) => e.contentHash)

    const hashToCuration = new Map(
      visibleHashes.flatMap((h) => {
        const rec = curationStore.get(h)
        return rec ? [[h, rec] as const] : []
      })
    )

    const filtered = applyFilterChips(
      hashToParams,
      hashToCuration,
      filterStore.chips,
      filterStore.showHidden,
      filterStore.timeRange,
      Date.now()
    )

    const registrySet = new Set(visibleHashes)
    const workflowGate = filterStore.workflow
    const visible = filtered.filter((h) => {
      if (!registrySet.has(h)) return false
      if (workflowGate !== null) {
        const params = hashToParams.get(h)
        if (!params || params.workflowFingerprint !== workflowGate) return false
      }
      return true
    })

    // Build filename map from registry entries. AssetEntry doesn't currently
    // carry a filename field — leave null-valued and rely on Plan 01's
    // contentHash tie-breaker inside compareAssetsForWithinCluster.
    const filenameByHash = new Map<string, string | null>(
      allEntries.map((e) => [e.contentHash, null])
    )

    const nestingOrder = computeNestingOrder(
      visible,
      hashToParams,
      filenameByHash,
      filterStore.activeGroupings
    )

    const { root, slots } = computeClusterLayout(
      visible,
      hashToParams,
      filenameByHash,
      nestingOrder,
      filterStore.withinClusterSort,
      filterStore.gridSpacing
    )

    return {
      slotByHash: new Map(slots.map((s) => [s.hash, s])),
      clusterTree: root,
      nestingOrder
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

  const clusterTree = computed<ClusterNode | null>(
    () => layout.value.clusterTree
  )

  const activeGroupingOrder = computed<readonly GroupingAxis[]>(
    () => layout.value.nestingOrder
  )

  return { entries, clusterTree, activeGroupingOrder }
}
