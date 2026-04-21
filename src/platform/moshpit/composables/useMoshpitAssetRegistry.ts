import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useAssetsStore } from '@/stores/assetsStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'

export interface AssetEntry {
  readonly id: string
  readonly contentHash: string
  readonly thumbUrl: string | undefined
  readonly hasMetadata: boolean
}

/**
 * Composes the three Moshpit Pinia stores into a single reactive view that
 * the PixiJS canvas (Plan 11) iterates. Phase 2 ignores filtering — Plan 11
 * reads every entry with a thumb URL. Phase 3 will layer filter/sort above.
 *
 * OSS-path handling (revision iter 1): AssetItem.asset_hash is null for
 * local-backend assets. The worker computes a contentHash and the queue
 * composable records `asset.id → contentHash` into metaStore.assetIdToHash
 * on thumbReady. This computed reads `a.asset_hash ?? metaStore.getHashForAssetId(a.id)`
 * so OSS assets appear in the registry as soon as the worker completes.
 *
 * Reactivity: the computed reads `metaStore.assetIdToHash.value.get(a.id)`
 * via the `.value` access on the ref, capturing the dependency. Any
 * `recordAssetHash` mutation triggers re-evaluation and new entries appear.
 */
export function useMoshpitAssetRegistry(): {
  readonly entries: ComputedRef<readonly AssetEntry[]>
} {
  const assetsStore = useAssetsStore()
  const thumbStore = useMoshpitThumbStore()
  const metaStore = useMoshpitMetadataStore()
  // storeToRefs restores the Ref wrapper that Pinia auto-unwraps on the store
  // instance. We need the ref itself so the computed() captures the Map
  // mutation as a reactive dependency (recordAssetHash calls .set on the Map
  // inside the ref — without tracking the ref, the computed never re-runs).
  const { assetIdToHash } = storeToRefs(metaStore)

  const entries = computed<readonly AssetEntry[]>(() => {
    const source = assetsStore.historyAssets
    // Touch the asset-id map ref so the computed tracks it reactively.
    // .value access captures the dependency; any recordAssetHash mutation
    // triggers re-evaluation.
    const assetIdMap = assetIdToHash.value
    const out: AssetEntry[] = []
    for (const a of source) {
      const hash = a.asset_hash ?? assetIdMap.get(a.id) ?? null
      if (!hash) continue
      out.push({
        id: a.id,
        contentHash: hash,
        thumbUrl: thumbStore.getUrl(hash),
        hasMetadata: metaStore.getMetadata(hash) !== undefined
      })
    }
    return out
  })

  return { entries }
}
