import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useMoshpitMetadataStore = defineStore('moshpitMetadata', () => {
  const metaByHash = ref(new Map<string, Readonly<Record<string, string>>>())
  // OSS-path bridge: asset.id → worker-computed contentHash. Populated by the
  // processing queue on thumbReady for assets that lacked a server asset_hash.
  // Read by useMoshpitAssetRegistry to fill in the hash for local-backend
  // assets so their sprites render.
  const assetIdToHash = ref(new Map<string, string>())
  const excludedCount = ref(0)
  const size = computed(() => metaByHash.value.size)

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
    assetIdToHash.value.clear()
    excludedCount.value = 0
  }

  return {
    excludedCount,
    assetIdToHash,
    size,
    setMetadata,
    getMetadata,
    recordAssetHash,
    getHashForAssetId,
    incrementExcluded,
    resetExcluded,
    reset
  }
})
