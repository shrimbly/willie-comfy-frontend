import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyParams } from '@/platform/moshpit/services/paramNormalize'
import type { ExcludedMessage, ThumbReadyMessage } from '@/platform/moshpit/services/workerMessages'
import type { WorkerBridge } from '@/platform/moshpit/services/workerBridge'

// Mock IDB helpers so tests never open a real IndexedDB
vi.mock('@/platform/moshpit/services/thumbRepository', () => ({
  getAllThumbHashes: vi.fn().mockResolvedValue([]),
  getAssetMeta: vi.fn().mockResolvedValue(undefined)
}))

import { getAllThumbHashes, getAssetMeta } from '@/platform/moshpit/services/thumbRepository'

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
    assetsStore.historyAssets.push({
      id: 'asset-1',
      name: 'output-001.png',
      asset_hash: null,
      tags: [],
      created_at: new Date().toISOString()
    })

    // setFilter triggers enqueue for the null-hash asset
    await queue.setFilter('F1', assetsStore.historyAssets)
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
      assetId: 'asset-1',
      params: emptyParams(Date.now())
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

  it('thumbReady overwrites params.timestamp with AssetItem.created_at epoch', async () => {
    const { bridge, fireThumbReady } = makeFakeBridge()
    const queue = useMoshpitProcessingQueue({ bridge })

    const createdAt = new Date('2024-03-15T12:00:00Z').toISOString()
    const expectedEpoch = new Date('2024-03-15T12:00:00Z').getTime()

    const assetsStore = useAssetsStore()
    assetsStore.historyAssets.push({
      id: 'asset-ts',
      name: 'sweep.png',
      asset_hash: null,
      tags: [],
      created_at: createdAt
    })

    await queue.setFilter('F1', assetsStore.historyAssets)

    // Worker posts params with its own timestamp (Date.now() fallback)
    const workerTimestamp = 9999
    fireThumbReady({
      type: 'thumbReady',
      id: 'F1:asset-ts',
      filterId: 'F1',
      contentHash: 'hash-ts',
      blob: new Blob(['x']),
      width: 512,
      height: 512,
      metadata: { workflow: '{}' },
      assetId: 'asset-ts',
      params: emptyParams(workerTimestamp)
    })

    const metaStore = useMoshpitMetadataStore()
    const stored = metaStore.getParams('hash-ts')
    // timestamp should be overwritten with the real AssetItem.created_at epoch
    expect(stored?.timestamp).toBe(expectedEpoch)
    // other fields should be preserved from worker params
    expect(stored?.workflowFingerprint).toBe('')

    queue.destroy()
  })

  it('thumbReady falls back to msg.params.timestamp when assetId not in assetsSnapshot', async () => {
    const { bridge, fireThumbReady } = makeFakeBridge()
    const queue = useMoshpitProcessingQueue({ bridge })

    // setFilter with empty assets
    await queue.setFilter('F1', [])

    const workerTimestamp = 54321
    fireThumbReady({
      type: 'thumbReady',
      id: 'F1:unknown',
      filterId: 'F1',
      contentHash: 'hash-fallback',
      blob: new Blob(['x']),
      width: 512,
      height: 512,
      metadata: { workflow: '{}' },
      assetId: 'unknown-asset',
      params: emptyParams(workerTimestamp)
    })

    const metaStore = useMoshpitMetadataStore()
    const stored = metaStore.getParams('hash-fallback')
    // fallback: msg.params.timestamp is used since assetId not in snapshot
    expect(stored?.timestamp).toBe(workerTimestamp)

    queue.destroy()
  })

  it('warm-cache setFilter populates paramsByHash from getAssetMeta without posting to worker', async () => {
    const { bridge } = makeFakeBridge()

    // Arrange: warm cache — all hashes already in IDB
    const cachedHash = 'warm-hash'
    vi.mocked(getAllThumbHashes).mockResolvedValue([cachedHash])
    const cachedParams = { ...emptyParams(8888), cfg: 5, steps: 10 }
    vi.mocked(getAssetMeta).mockResolvedValue({
      contentHash: cachedHash,
      metadata: { workflow: '{}' },
      curation: { favourite: false, tags: [], folders: [], hidden: false },
      params: cachedParams
    })

    const queue = useMoshpitProcessingQueue({ bridge })
    const assetsStore = useAssetsStore()
    assetsStore.historyAssets.push({
      id: 'asset-warm',
      name: 'sweep.png',
      asset_hash: cachedHash,
      tags: [],
      created_at: new Date().toISOString()
    })

    await queue.setFilter('F1', assetsStore.historyAssets)

    // No worker message should be posted (all cached)
    expect(bridge.enqueue).not.toHaveBeenCalled()

    // paramsByHash should be populated from IDB
    const metaStore = useMoshpitMetadataStore()
    expect(metaStore.getParams(cachedHash)).toEqual(cachedParams)

    queue.destroy()
  })
})
