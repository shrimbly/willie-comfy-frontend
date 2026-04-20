import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { NormalizedParams } from '../services/paramNormalize'

export const useMoshpitMetadataStore = defineStore('moshpitMetadata', () => {
  const metaByHash = ref(new Map<string, Readonly<Record<string, string>>>())
  // OSS-path bridge: asset.id → worker-computed contentHash. Populated by the
  // processing queue on thumbReady for assets that lacked a server asset_hash.
  // Read by useMoshpitAssetRegistry to fill in the hash for local-backend
  // assets so their sprites render.
  const assetIdToHash = ref(new Map<string, string>())
  const excludedCount = ref(0)
  const size = computed(() => metaByHash.value.size)
  // Explicit params store keyed by contentHash. Populated by the processing
  // queue on thumbReady (cold path) and by setFilter warm-cache re-entry.
  // The worker produces params with the correct workflowFilename derived from
  // the source filename at processing time (Plan 03-05).
  const _paramsByHash = ref(new Map<string, NormalizedParams>())
  // Expose as a plain Map (not a Ref wrapper) so consumers can call .get()/.size
  // directly without .value dereference. Reactivity is preserved via the ref.
  const paramsByHash = computed(() => _paramsByHash.value)

  function setMetadata(
    contentHash: string,
    meta: Readonly<Record<string, string>>
  ): void {
    metaByHash.value.set(contentHash, meta)
  }

  function getMetadata(
    contentHash: string
  ): Readonly<Record<string, string>> | undefined {
    return metaByHash.value.get(contentHash)
  }

  function setParams(contentHash: string, params: NormalizedParams): void {
    _paramsByHash.value.set(contentHash, params)
  }

  function getParams(contentHash: string): NormalizedParams | undefined {
    return _paramsByHash.value.get(contentHash)
  }

  function recordAssetHash(assetId: string, contentHash: string): void {
    assetIdToHash.value.set(assetId, contentHash)
  }

  function getHashForAssetId(assetId: string): string | undefined {
    return assetIdToHash.value.get(assetId)
  }

  function incrementExcluded(): void {
    excludedCount.value++
  }

  function resetExcluded(): void {
    excludedCount.value = 0
  }

  function reset(): void {
    metaByHash.value.clear()
    _paramsByHash.value.clear()
    assetIdToHash.value.clear()
    excludedCount.value = 0
  }

  return {
    excludedCount,
    assetIdToHash,
    paramsByHash,
    size,
    setMetadata,
    getMetadata,
    setParams,
    getParams,
    recordAssetHash,
    getHashForAssetId,
    incrementExcluded,
    resetExcluded,
    reset
  }
})
