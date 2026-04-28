import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'

import { useAssetsStore } from '@/stores/assetsStore'
import { assetService } from '@/platform/assets/services/assetService'

// Mock the api module
vi.mock('@/scripts/api', () => ({
  api: {
    internalURL: vi.fn((path: string) => `http://localhost:3000${path}`),
    apiURL: vi.fn((path: string) => `http://localhost:3000/api${path}`),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    user: 'test-user'
  }
}))

// Mock the asset service
vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetsByTag: vi.fn(),
    getAssetsForNodeType: vi.fn()
  }
}))

// Mock distribution type - hoisted so it can be changed per test
const mockIsCloud = vi.hoisted(() => ({ value: false }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

// Mock modelToNodeStore with proper node providers and category lookups
vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({
    getAllNodeProviders: vi.fn((category: string) => {
      const providers: Record<
        string,
        Array<{ nodeDef: { name: string }; key: string }>
      > = {
        checkpoints: [
          { nodeDef: { name: 'CheckpointLoaderSimple' }, key: 'ckpt_name' },
          { nodeDef: { name: 'ImageOnlyCheckpointLoader' }, key: 'ckpt_name' }
        ],
        loras: [
          { nodeDef: { name: 'LoraLoader' }, key: 'lora_name' },
          { nodeDef: { name: 'LoraLoaderModelOnly' }, key: 'lora_name' }
        ],
        vae: [{ nodeDef: { name: 'VAELoader' }, key: 'vae_name' }]
      }
      return providers[category] ?? []
    }),
    getCategoryForNodeType: vi.fn((nodeType: string) => {
      const nodeToCategory: Record<string, string> = {
        CheckpointLoaderSimple: 'checkpoints',
        ImageOnlyCheckpointLoader: 'checkpoints',
        LoraLoader: 'loras',
        LoraLoaderModelOnly: 'loras',
        VAELoader: 'vae'
      }
      return nodeToCategory[nodeType]
    }),
    getNodeProvider: vi.fn(),
    registerDefaults: vi.fn()
  })
}))

// Mock asset mappers - add unique timestamps
vi.mock('@/platform/assets/composables/media/assetMappers', () => ({
  mapInputFileToAssetItem: vi.fn(
    (name: string, index: number, type: string, mtime?: number) => ({
      id: `${type}-${index}-${name}`,
      name,
      size: 0,
      created_at: mtime
        ? new Date(mtime * 1000).toISOString()
        : new Date(Date.now() - index * 1000).toISOString(),
      tags: [type],
      preview_url: `http://test.com/${name}`
    })
  )
}))

// Mock global fetch for file-based output/input fetching
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('assetsStore - Output Files', () => {
  let store: ReturnType<typeof useAssetsStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useAssetsStore()
    vi.clearAllMocks()
  })

  describe('Initial Load', () => {
    it('should load output files via /files/output endpoint', async () => {
      const mockFiles: [string, number][] = [
        ['output_0.png', 1000],
        ['output_1.png', 2000],
        ['output_2.png', 3000]
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFiles)
      })

      await store.updateHistory()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/files/output',
        { headers: { 'Comfy-User': 'test-user' } }
      )
      expect(store.historyAssets).toHaveLength(3)
      expect(store.historyLoading).toBe(false)
      expect(store.historyError).toBe(null)
    })

    it('should handle errors during fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await store.updateHistory()

      expect(store.historyAssets).toHaveLength(0)
      expect(store.historyError).toBeTruthy()
      expect(store.historyLoading).toBe(false)
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await store.updateHistory()

      expect(store.historyAssets).toHaveLength(0)
      expect(store.historyError).toBeTruthy()
      expect(store.historyLoading).toBe(false)
    })
  })

  describe('Refresh', () => {
    it('should replace data on refresh', async () => {
      // Initial load
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            ['old_file.png', 1000],
            ['old_file2.png', 2000]
          ] as [string, number][])
      })
      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(2)

      // Refresh with new data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            ['new_file.png', 3000],
            ['new_file2.png', 4000],
            ['new_file3.png', 5000]
          ] as [string, number][])
      })
      await store.updateHistory()
      expect(store.historyAssets).toHaveLength(3)
    })
  })

  describe('Input Files', () => {
    it('should load input files via /files/input endpoint', async () => {
      const mockFiles: [string, number][] = [
        ['input_0.png', 1000],
        ['input_1.png', 2000]
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFiles)
      })

      await store.updateInputs()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/files/input',
        { headers: { 'Comfy-User': 'test-user' } }
      )
      expect(store.inputAssets).toHaveLength(2)
    })
  })
})

describe('assetsStore - Model Assets Cache (Cloud)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockIsCloud.value = true
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockIsCloud.value = false
  })

  const createMockAsset = (id: string, tags: string[] = ['models']) => ({
    id,
    name: `asset-${id}`,
    size: 100,
    created_at: new Date().toISOString(),
    tags,
    preview_url: `http://test.com/${id}`
  })

  describe('getAssets cache invalidation', () => {
    it('should invalidate cache before mutating assets during batch loading', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      const firstBatch = Array.from({ length: 500 }, (_, i) =>
        createMockAsset(`asset-${i}`)
      )
      const secondBatch = Array.from({ length: 100 }, (_, i) =>
        createMockAsset(`asset-${500 + i}`)
      )

      let callCount = 0
      vi.mocked(assetService.getAssetsForNodeType).mockImplementation(
        async () => {
          callCount++
          return callCount === 1 ? firstBatch : secondBatch
        }
      )

      await store.updateModelsForNodeType(nodeType)

      // Wait for background batch loading to complete
      await vi.waitFor(() => {
        expect(
          vi.mocked(assetService.getAssetsForNodeType)
        ).toHaveBeenCalledTimes(2)
      })

      const assets = store.getAssets(nodeType)
      expect(assets).toHaveLength(600)
    })

    it('should not return stale cached array after background batch completes', async () => {
      const store = useAssetsStore()
      const nodeType = 'LoraLoader'

      // First batch must be exactly MODEL_BATCH_SIZE (500) to trigger hasMore
      const firstBatch = Array.from({ length: 500 }, (_, i) =>
        createMockAsset(`first-${i}`)
      )
      const secondBatch = [createMockAsset('new-asset')]

      let callCount = 0
      vi.mocked(assetService.getAssetsForNodeType).mockImplementation(
        async () => {
          callCount++
          return callCount === 1 ? firstBatch : secondBatch
        }
      )

      await store.updateModelsForNodeType(nodeType)

      // Wait for background batch loading to complete
      await vi.waitFor(() => {
        expect(
          vi.mocked(assetService.getAssetsForNodeType)
        ).toHaveBeenCalledTimes(2)
      })

      const assets = store.getAssets(nodeType)
      expect(assets).toHaveLength(501)
      expect(assets.map((a) => a.id)).toContain('new-asset')
    })

    it('should return cached array on subsequent getAssets calls', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const assets = [createMockAsset('cache-test-1')]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(assets)
      await store.updateModelsForNodeType(nodeType)

      const firstCall = store.getAssets(nodeType)
      const secondCall = store.getAssets(nodeType)

      expect(secondCall).toBe(firstCall)
      expect(firstCall).toHaveLength(1)
    })
  })

  describe('concurrent request handling', () => {
    it('should short-circuit concurrent calls to prevent duplicate work', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const firstBatch = Array.from({ length: 5 }, (_, i) =>
        createMockAsset(`first-${i}`)
      )

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(firstBatch)

      // Start two concurrent requests for the same category
      const firstRequest = store.updateModelsForNodeType(nodeType)
      const secondRequest = store.updateModelsForNodeType(nodeType)
      await Promise.all([firstRequest, secondRequest])

      // Second request should be short-circuited, only one API call made
      expect(
        vi.mocked(assetService.getAssetsForNodeType)
      ).toHaveBeenCalledTimes(1)
      expect(store.getAssets(nodeType)).toHaveLength(5)
    })

    it('should allow new request after previous completes', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'
      const firstBatch = [createMockAsset('first-1')]
      const secondBatch = [
        createMockAsset('second-1'),
        createMockAsset('second-2')
      ]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        firstBatch
      )
      await store.updateModelsForNodeType(nodeType)
      expect(store.getAssets(nodeType)).toHaveLength(1)

      // After first completes, a new request should work
      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        secondBatch
      )
      store.invalidateCategory('checkpoints')
      await store.updateModelsForNodeType(nodeType)

      expect(store.getAssets(nodeType)).toHaveLength(2)
      expect(
        vi.mocked(assetService.getAssetsForNodeType)
      ).toHaveBeenCalledTimes(2)
    })
  })

  describe('shallowReactive state reactivity', () => {
    it('should trigger reactivity on isModelLoading change', async () => {
      const store = useAssetsStore()
      const nodeType = 'CheckpointLoaderSimple'

      const loadingStates: boolean[] = []
      watch(
        () => store.isModelLoading(nodeType),
        (val) => loadingStates.push(val),
        { immediate: true }
      )

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue([])
      await store.updateModelsForNodeType(nodeType)
      await nextTick()

      expect(loadingStates).toContain(true)
      expect(loadingStates).toContain(false)
    })
  })

  describe('category-keyed cache', () => {
    it('should share cache between node types of the same category', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('shared-1'), createMockAsset('shared-2')]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(assets)

      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      expect(store.getAssets('CheckpointLoaderSimple')).toHaveLength(2)
      expect(store.getAssets('ImageOnlyCheckpointLoader')).toHaveLength(2)
      expect(
        vi.mocked(assetService.getAssetsForNodeType)
      ).toHaveBeenCalledTimes(1)
    })

    it('should return empty array for unknown node types', () => {
      const store = useAssetsStore()
      expect(store.getAssets('UnknownNodeType')).toEqual([])
    })

    it('should not fetch for unknown node types', async () => {
      const store = useAssetsStore()
      await store.updateModelsForNodeType('UnknownNodeType')
      expect(
        vi.mocked(assetService.getAssetsForNodeType)
      ).not.toHaveBeenCalled()
    })
  })

  describe('invalidateCategory', () => {
    it('should clear cache for a category', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('asset-1'), createMockAsset('asset-2')]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(assets)
      await store.updateModelsForNodeType('CheckpointLoaderSimple')
      expect(store.getAssets('CheckpointLoaderSimple')).toHaveLength(2)

      store.invalidateCategory('checkpoints')

      expect(store.getAssets('CheckpointLoaderSimple')).toEqual([])
      expect(store.hasAssetKey('CheckpointLoaderSimple')).toBe(false)
    })

    it('should allow refetch after invalidation', async () => {
      const store = useAssetsStore()
      const initialAssets = [createMockAsset('initial-1')]
      const refreshedAssets = [
        createMockAsset('refreshed-1'),
        createMockAsset('refreshed-2')
      ]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        initialAssets
      )
      await store.updateModelsForNodeType('LoraLoader')
      expect(store.getAssets('LoraLoader')).toHaveLength(1)

      store.invalidateCategory('loras')

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        refreshedAssets
      )
      await store.updateModelsForNodeType('LoraLoader')

      expect(store.getAssets('LoraLoader')).toHaveLength(2)
    })

    it('should invalidate tag-based caches', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('tag-asset-1')]

      vi.mocked(assetService.getAssetsByTag).mockResolvedValue(assets)
      await store.updateModelsForTag('models')
      expect(store.getAssets('tag:models')).toHaveLength(1)

      store.invalidateCategory('tag:models')

      expect(store.getAssets('tag:models')).toEqual([])
    })
  })

  describe('hasCategory', () => {
    it('should return true for loaded categories', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('asset-1')]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(assets)
      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      expect(store.hasCategory('checkpoints')).toBe(true)
    })

    it('should return true for tag-based category when tag: prefix is not used', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('asset-1')]

      vi.mocked(assetService.getAssetsByTag).mockResolvedValue(assets)
      await store.updateModelsForTag('models')

      // hasCategory('models') checks for both 'models' and 'tag:models'
      expect(store.hasCategory('models')).toBe(true)
    })

    it('should return false for unloaded categories', () => {
      const store = useAssetsStore()

      expect(store.hasCategory('checkpoints')).toBe(false)
      expect(store.hasCategory('unknown-category')).toBe(false)
    })

    it('should return false after category is invalidated', async () => {
      const store = useAssetsStore()
      const assets = [createMockAsset('asset-1')]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValue(assets)
      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      expect(store.hasCategory('checkpoints')).toBe(true)

      store.invalidateCategory('checkpoints')

      expect(store.hasCategory('checkpoints')).toBe(false)
    })
  })

  describe('invalidateModelsForCategory', () => {
    it('should clear cache for category and trigger refetch on next access', async () => {
      const store = useAssetsStore()
      const initialAssets = [createMockAsset('initial-1')]
      const refreshedAssets = [
        createMockAsset('refreshed-1'),
        createMockAsset('refreshed-2')
      ]

      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        initialAssets
      )
      await store.updateModelsForNodeType('CheckpointLoaderSimple')
      expect(store.getAssets('CheckpointLoaderSimple')).toHaveLength(1)

      store.invalidateModelsForCategory('checkpoints')

      // Cache should be cleared
      expect(store.hasCategory('checkpoints')).toBe(false)
      expect(store.getAssets('CheckpointLoaderSimple')).toEqual([])

      // Next fetch should get fresh data
      vi.mocked(assetService.getAssetsForNodeType).mockResolvedValueOnce(
        refreshedAssets
      )
      await store.updateModelsForNodeType('CheckpointLoaderSimple')
      expect(store.getAssets('CheckpointLoaderSimple')).toHaveLength(2)
    })

    it('should clear tag-based caches', async () => {
      const store = useAssetsStore()
      const tagAssets = [createMockAsset('tag-1'), createMockAsset('tag-2')]

      vi.mocked(assetService.getAssetsByTag).mockResolvedValue(tagAssets)
      await store.updateModelsForTag('checkpoints')
      await store.updateModelsForTag('models')

      expect(store.getAssets('tag:checkpoints')).toHaveLength(2)
      expect(store.getAssets('tag:models')).toHaveLength(2)

      store.invalidateModelsForCategory('checkpoints')

      expect(store.getAssets('tag:checkpoints')).toEqual([])
      expect(store.getAssets('tag:models')).toEqual([])
    })

    it('should handle unknown categories gracefully', () => {
      const store = useAssetsStore()

      expect(() =>
        store.invalidateModelsForCategory('unknown-category')
      ).not.toThrow()
    })
  })
})
