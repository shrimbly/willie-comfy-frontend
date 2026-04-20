import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

describe('useMoshpitProcessingQueue (Wave 3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('diff(filtered, cached) returns the set difference by key', async () => {
    const { computeQueueDelta } = await import('./useMoshpitProcessingQueue')
    const filtered = [
      { id: '1', assetHash: 'a' },
      { id: '2', assetHash: 'b' }
    ]
    const cachedHashes = new Set(['a'])
    const delta = computeQueueDelta(filtered, cachedHashes)
    expect(delta.map((x) => x.assetHash)).toEqual(['b'])
  })

  it('when cache is fully warm the delta is empty (D-08 short-circuit)', async () => {
    const { computeQueueDelta } = await import('./useMoshpitProcessingQueue')
    const filtered = [{ id: '1', assetHash: 'a' }]
    const cachedHashes = new Set(['a'])
    expect(computeQueueDelta(filtered, cachedHashes)).toHaveLength(0)
  })

  it('assets without asset_hash fall through to the worker (client-side hash path)', async () => {
    const { computeQueueDelta } = await import('./useMoshpitProcessingQueue')
    const filtered = [{ id: '1', assetHash: null }]
    const delta = computeQueueDelta(filtered, new Set())
    expect(delta).toHaveLength(1)
  })
})
