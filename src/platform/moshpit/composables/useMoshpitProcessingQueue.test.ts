import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExcludedMessage, ThumbReadyMessage } from '@/platform/moshpit/services/workerMessages'
import type { WorkerBridge } from '@/platform/moshpit/services/workerBridge'

// Mock IDB helpers so tests never open a real IndexedDB
vi.mock('@/platform/moshpit/services/thumbRepository', () => ({
  getAllThumbHashes: vi.fn().mockResolvedValue([]),
  getAssetMeta: vi.fn().mockResolvedValue(undefined)
}))

// Mock createWorkerBridge so the composable never spawns a real Worker
vi.mock('@/platform/moshpit/services/workerBridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/moshpit/services/workerBridge')>()
  return {
    ...actual,
    createWorkerBridge: vi.fn()
  }
})

import { computeQueueDelta, useMoshpitProcessingQueue } from './useMoshpitProcessingQueue'
import { useMoshpitAssetRegistry } from './useMoshpitAssetRegistry'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'
import { useAssetsStore } from '@/stores/assetsStore'

/** Build a fake WorkerBridge that lets tests manually fire callbacks. */
function makeFakeBridge() {
  let thumbReadyCb: ((msg: ThumbReadyMessage) => void) | null = null
  let excludedCb: ((msg: ExcludedMessage) => void) | null = null

  const bridge: WorkerBridge = {
    enqueue: vi.fn(),
    cancel: vi.fn(),
    cancelAll: vi.fn(),
    setActiveFilterId: vi.fn(),
    onThumbReady(cb) {
      thumbReadyCb = cb
      return () => { thumbReadyCb = null }
    },
    onExcluded(cb) {
      excludedCb = cb
      return () => { excludedCb = null }
    },
    onError: vi.fn(() => () => {}),
    destroy: vi.fn()
  }

  function fireThumbReady(msg: ThumbReadyMessage) {
    thumbReadyCb?.(msg)
  }

  function fireExcluded(msg: ExcludedMessage) {
    excludedCb?.(msg)
  }

  return { bridge, fireThumbReady, fireExcluded }
}

describe('useMoshpitProcessingQueue (Wave 3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock/thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('diff(filtered, cached) returns the set difference by key', () => {
    const filtered = [
      { id: '1', assetHash: 'a' },
      { id: '2', assetHash: 'b' }
    ]
    const cachedHashes = new Set(['a'])
    const delta = computeQueueDelta(filtered, cachedHashes)
    expect(delta.map((x) => x.assetHash)).toEqual(['b'])
  })

  it('when cache is fully warm the delta is empty (D-08 short-circuit)', () => {
    const filtered = [{ id: '1', assetHash: 'a' }]
    const cachedHashes = new Set(['a'])
    expect(computeQueueDelta(filtered, cachedHashes)).toHaveLength(0)
  })

  it('assets without asset_hash fall through to the worker (client-side hash path)', () => {
    const filtered = [{ id: '1', assetHash: null }]
    const delta = computeQueueDelta(filtered, new Set())
    expect(delta).toHaveLength(1)
  })

  it('thumbReady bridges asset.id → contentHash via metaStore.recordAssetHash (OSS path)', async () => {
    const { bridge, fireThumbReady } = makeFakeBridge()
    const queue = useMoshpitProcessingQueue({ bridge })

    // Seed assetsStore with an OSS-path asset (asset_hash is null)
    const assetsStore = useAssetsStore()
    assetsStore.outputJobAssets.push({
      id: 'asset-1',
      name: 'output-001.png',
      asset_hash: null,
      tags: [],
      created_at: new Date().toISOString()
    })

    // setFilter triggers enqueue for the null-hash asset
    await queue.setFilter('F1', assetsStore.outputJobAssets)
    expect(bridge.enqueue).toHaveBeenCalledOnce()

    // Simulate the worker posting thumbReady back
    fireThumbReady({
      type: 'thumbReady',
      id: 'F1:asset-1',
      filterId: 'F1',
      contentHash: 'hash-A',
      blob: new Blob(['fake-thumb']),
      width: 512,
      height: 512,
      metadata: { workflow: '{}' },
      assetId: 'asset-1'
    })

    // Assert: metaStore records the asset.id → contentHash bridge
    const metaStore = useMoshpitMetadataStore()
    expect(metaStore.getHashForAssetId('asset-1')).toBe('hash-A')

    // Assert: thumbStore has the blob URL for hash-A
    const thumbStore = useMoshpitThumbStore()
    expect(thumbStore.getUrl('hash-A')).toBe('blob:mock/thumb')

    // Assert: registry entry appears for the OSS-path asset (reactivity check)
    const { entries } = useMoshpitAssetRegistry()
    const entry = entries.value.find((e) => e.id === 'asset-1')
    expect(entry).toBeDefined()
    expect(entry?.contentHash).toBe('hash-A')
    expect(entry?.thumbUrl).toBe('blob:mock/thumb')

    queue.destroy()
  })
})
