import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { emptyParams } from '../services/paramNormalize'
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

  it('setParams + getParams round-trips NormalizedParams by contentHash', () => {
    const store = useMoshpitMetadataStore()
    const params = {
      ...emptyParams(1000),
      cfg: 7.5,
      steps: 25,
      model: 'v1-5.safetensors'
    }
    store.setParams('hash-X', params)
    expect(store.getParams('hash-X')).toEqual(params)
  })

  it('getParams returns undefined for unknown hash', () => {
    const store = useMoshpitMetadataStore()
    expect(store.getParams('unknown')).toBeUndefined()
  })

  it('reset clears paramsByHash', () => {
    const store = useMoshpitMetadataStore()
    store.setParams('hash-X', emptyParams(1000))
    store.reset()
    expect(store.getParams('hash-X')).toBeUndefined()
    expect(store.paramsByHash.size).toBe(0)
  })

  it('paramsByHash updates reactively when setParams is called', () => {
    const store = useMoshpitMetadataStore()
    const params = emptyParams(2000)
    expect(store.paramsByHash.size).toBe(0)
    store.setParams('hash-Y', params)
    expect(store.paramsByHash.size).toBe(1)
    expect(store.paramsByHash.get('hash-Y')).toEqual(params)
  })
})
