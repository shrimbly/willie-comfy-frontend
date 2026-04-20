import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useMoshpitMetadataStore } from './moshpitMetadataStore'

describe('moshpitMetadataStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('setMetadata + getMetadata round-trips', () => {
    const store = useMoshpitMetadataStore()
    store.setMetadata('h1', { workflow: '{}' })
    expect(store.getMetadata('h1')).toEqual({ workflow: '{}' })
  })

  it('incrementExcluded and resetExcluded track excludedCount', () => {
    const store = useMoshpitMetadataStore()
    expect(store.excludedCount).toBe(0)
    store.incrementExcluded()
    store.incrementExcluded()
    expect(store.excludedCount).toBe(2)
    store.resetExcluded()
    expect(store.excludedCount).toBe(0)
  })

  it('recordAssetHash + getHashForAssetId round-trip (OSS-path bridge)', () => {
    const store = useMoshpitMetadataStore()
    expect(store.getHashForAssetId('asset-1')).toBeUndefined()
    store.recordAssetHash('asset-1', 'hash-A')
    expect(store.getHashForAssetId('asset-1')).toBe('hash-A')
    // Re-recording overwrites
    store.recordAssetHash('asset-1', 'hash-B')
    expect(store.getHashForAssetId('asset-1')).toBe('hash-B')
  })

  it('reset clears the map, the count, AND the assetIdToHash bridge', () => {
    const store = useMoshpitMetadataStore()
    store.setMetadata('h1', { k: 'v' })
    store.incrementExcluded()
    store.recordAssetHash('asset-1', 'hash-A')
    store.reset()
    expect(store.getMetadata('h1')).toBeUndefined()
    expect(store.excludedCount).toBe(0)
    expect(store.getHashForAssetId('asset-1')).toBeUndefined()
  })
})
