import type { ComputedRef, InjectionKey, Ref } from 'vue'
import { computed, onBeforeUnmount, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetUrl } from '@/platform/assets/utils/assetUrlUtil'
import type { NormalizedParams } from '@/platform/moshpit/services/paramNormalize'
import {
  getAssetMeta,
  getAllThumbHashes
} from '@/platform/moshpit/services/thumbRepository'
import type { WorkerBridge } from '@/platform/moshpit/services/workerBridge'
import { createWorkerBridge } from '@/platform/moshpit/services/workerBridge'
import { useMoshpitCurationStore } from '@/platform/moshpit/stores/moshpitCurationStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'

export interface QueueAssetView {
  readonly id: string
  readonly assetHash: string | null
}

/**
 * Contract for downstream consumers (sprite layer, indicator pill, layout).
 * Consumers MUST accept this type and MUST NOT call useMoshpitProcessingQueue()
 * a second time — a second call instantiates a second WorkerBridge whose
 * counters and bridge callbacks live in a parallel universe to the real
 * processing, guaranteeing that any watch of `total/done` returns zero forever.
 * MoshpitLayout.vue is the single owner; it passes this shape down the tree.
 */
export interface ProcessingQueueState {
  readonly total: Readonly<Ref<number>>
  readonly done: Readonly<Ref<number>>
  readonly isActive: Readonly<ComputedRef<boolean>>
  readonly activeFilterId: Readonly<Ref<string>>
  setFilter(filterKey: string, assets: readonly AssetItem[]): Promise<void>
  cancel(): void
  destroy(): void
}

/**
 * Injection key for providing ProcessingQueueState from MoshpitLayout to
 * MoshpitCanvas without prop-drilling through MoshpitView. MoshpitLayout is
 * the single owner of useMoshpitProcessingQueue(); all consumers must inject
 * this key rather than calling the composable a second time.
 */
export const MOSHPIT_QUEUE_INJECTION_KEY: InjectionKey<ProcessingQueueState> =
  Symbol('moshpit:queue')

/**
 * Pure diff: which of `filtered` lack a cached thumb?
 *
 * Assets without a known `assetHash` (OSS path) are always enqueued — the
 * worker will compute the hash and the warm-cache check runs post-hash via
 * the IDB `get` in the thumbReady handler.
 *
 * D-08 warm-cache short-circuit: when `cachedHashes` covers every entry in
 * `filtered`, this returns an empty array and the caller MUST NOT post to the
 * bridge (ASSET-10).
 */
export function computeQueueDelta(
  filtered: readonly QueueAssetView[],
  cachedHashes: ReadonlySet<string>
): QueueAssetView[] {
  return filtered.filter((a) => {
    if (!a.assetHash || a.assetHash.length === 0) return true
    return !cachedHashes.has(a.assetHash)
  })
}

export function useMoshpitProcessingQueue(options?: {
  bridge?: WorkerBridge
}): ProcessingQueueState {
  const bridge = options?.bridge ?? createWorkerBridge()
  const thumbStore = useMoshpitThumbStore()
  const metaStore = useMoshpitMetadataStore()
  const curationStore = useMoshpitCurationStore()

  const total = ref(0)
  const done = ref(0)
  const activeFilterId = ref('')
  const isActive = computed(() => total.value > 0 && done.value < total.value)

  // Snapshot of the current filter's assets — used to look up the real
  // AssetItem.created_at for each thumbReady so params.timestamp reflects
  // the actual creation time rather than the worker's Date.now() fallback.
  const assetsSnapshot = ref<readonly AssetItem[]>([])

  const offReady = bridge.onThumbReady((msg) => {
    thumbStore.addThumb(msg.contentHash, msg.blob)
    metaStore.setMetadata(msg.contentHash, msg.metadata)
    // OSS-path bridge (revision iter 1): record asset.id → contentHash so
    // useMoshpitAssetRegistry can resolve a.asset_hash ?? getHashForAssetId(a.id)
    // for local-backend assets whose server-side asset_hash is null.
    metaStore.recordAssetHash(msg.assetId, msg.contentHash)

    // Overwrite params.timestamp with the real AssetItem.created_at epoch.
    // The worker uses Date.now() as a fallback; the processing queue knows the
    // actual creation timestamp from the AssetItem loaded by setFilter.
    const asset = assetsSnapshot.value.find((a) => a.id === msg.assetId)
    const createdAtMs =
      asset?.created_at ? new Date(asset.created_at).getTime() : NaN
    const paramsWithRealTimestamp: NormalizedParams = {
      ...msg.params,
      timestamp: Number.isFinite(createdAtMs) ? createdAtMs : msg.params.timestamp
    }
    metaStore.setParams(msg.contentHash, paramsWithRealTimestamp)

    // Hydrate curation from IDB so hidden/favourite flags are reflected
    // even for thumbs that landed on a prior session.
    void getAssetMeta(msg.contentHash).then((rec) => {
      if (rec) curationStore.load(rec)
    })
    done.value++
  })

  const offExcluded = bridge.onExcluded(() => {
    metaStore.incrementExcluded()
    total.value = Math.max(0, total.value - 1)
  })

  const offError = bridge.onError((msg) => {
    console.error('[moshpit] worker error', msg.message)
  })

  async function setFilter(
    filterKey: string,
    assets: readonly AssetItem[]
  ): Promise<void> {
    // New filter invalidates any in-flight work from the previous one
    if (activeFilterId.value !== '' && activeFilterId.value !== filterKey) {
      bridge.cancelAll()
      total.value = 0
      done.value = 0
      metaStore.resetExcluded()
    }
    activeFilterId.value = filterKey
    bridge.setActiveFilterId(filterKey)

    // Snapshot assets for timestamp correction in the thumbReady handler.
    assetsSnapshot.value = assets

    // D-08 warm-cache diff against IDB (D-07 auto-resume on re-entry)
    const cached = new Set(await getAllThumbHashes())
    const asViews: QueueAssetView[] = assets.map((a) => ({
      id: a.id,
      assetHash: a.asset_hash ?? null
    }))
    const delta = computeQueueDelta(asViews, cached)

    // Warm-cache re-entry: populate metaStore.paramsByHash from IDB for assets
    // whose thumbs are already cached. This avoids re-running the worker and
    // ensures paramsByHash is fully populated for filter/sort on re-entry.
    // Chunk size 10 bounds concurrent IDB reads (T-03-05-02 mitigation).
    const cachedViews = asViews.filter((v) => v.assetHash && cached.has(v.assetHash))
    const CHUNK_SIZE = 10
    for (let i = 0; i < cachedViews.length; i += CHUNK_SIZE) {
      const chunk = cachedViews.slice(i, i + CHUNK_SIZE)
      await Promise.allSettled(
        chunk.map(async (view) => {
          if (!view.assetHash) return
          const rec = await getAssetMeta(view.assetHash)
          if (!rec) return
          metaStore.setMetadata(view.assetHash, rec.metadata)
          metaStore.setParams(view.assetHash, rec.params)
        })
      )
    }

    total.value = delta.length
    done.value = 0

    // D-08 warm-cache short-circuit: bridge is NEVER posted to (ASSET-10)
    if (delta.length === 0) return

    // Enqueue each delta asset through the bridge
    for (const view of delta) {
      const src = assets.find((a) => a.id === view.id)
      if (!src) continue
      bridge.enqueue({
        id: `${filterKey}:${view.id}`,
        filterId: filterKey,
        fetchUrl: getAssetUrl(src),
        assetId: view.id, // T-02-08-01: namespaced id prevents cross-filter spoofing
        assetHash: view.assetHash
      })
    }
  }

  function cancel(): void {
    bridge.cancelAll()
    // Per D-06: keep completed thumbs in IDB. The pill dismisses cleanly by
    // setting total = done so isActive flips to false.
    total.value = done.value
  }

  function destroy(): void {
    offReady()
    offExcluded()
    offError()
    bridge.destroy()
  }

  onBeforeUnmount(destroy)

  return { total, done, isActive, activeFilterId, setFilter, cancel, destroy }
}
