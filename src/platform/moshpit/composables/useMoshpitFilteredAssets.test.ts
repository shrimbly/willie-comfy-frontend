import { computed, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyParams } from '../services/paramNormalize'
import type { NormalizedParams } from '../services/paramNormalize'
import type {
  AssetMetaRecord,
  CurationRecord
} from '../services/thumbRepository.types'
import { useMoshpitFilteredAssets } from './useMoshpitFilteredAssets'
import { useMoshpitFilterStore } from '../stores/moshpitFilterStore'
import { useMoshpitMetadataStore } from '../stores/moshpitMetadataStore'
import { useMoshpitCurationStore } from '../stores/moshpitCurationStore'

// Stub the asset registry — we control entries in tests
vi.mock('./useMoshpitAssetRegistry', () => ({
  useMoshpitAssetRegistry: vi.fn()
}))

import { useMoshpitAssetRegistry } from './useMoshpitAssetRegistry'
const mockRegistry = vi.mocked(useMoshpitAssetRegistry)

type RegistryEntry = {
  id: string
  contentHash: string
  thumbUrl: string | undefined
  hasMetadata: boolean
}

function makeEntry(hash: string, thumbUrl?: string): RegistryEntry {
  return {
    id: hash,
    contentHash: hash,
    thumbUrl: thumbUrl ?? `blob:/${hash}`,
    hasMetadata: true
  }
}

function makeParams(
  overrides: Partial<NormalizedParams> = {}
): NormalizedParams {
  return {
    ...emptyParams(1000),
    workflowFingerprint: 'test-fp',
    workflowFilename: 'test',
    ...overrides
  }
}

function seedRegistry(
  metaStore: ReturnType<typeof useMoshpitMetadataStore>,
  hashes: string[],
  paramOverrides: Partial<NormalizedParams> = {}
): void {
  for (const h of hashes) {
    metaStore.setParams(h, makeParams(paramOverrides))
  }
}

function seedCuration(
  curationStore: ReturnType<typeof useMoshpitCurationStore>,
  hash: string,
  overrides: Partial<CurationRecord>
): void {
  const curation: CurationRecord = {
    favourite: false,
    tags: [],
    folders: [],
    hidden: false,
    ...overrides
  }
  const record: AssetMetaRecord = {
    contentHash: hash,
    metadata: {},
    curation,
    params: emptyParams(0)
  }
  curationStore.load(record)
}

describe('useMoshpitFilteredAssets', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('FILTER-01 gate', () => {
    it('entries is empty and clusterTree is null when not gated', () => {
      const entries = ref([makeEntry('hash-A')])
      mockRegistry.mockReturnValue({ entries: computed(() => entries.value) })
      const metaStore = useMoshpitMetadataStore()
      seedRegistry(metaStore, ['hash-A'])
      // workflow is null by default — isGated = false
      const { entries: filtered, clusterTree } = useMoshpitFilteredAssets()
      expect(filtered.value).toHaveLength(0)
      expect(clusterTree.value).toBeNull()
    })

    it('entries is non-empty once workflow is set', () => {
      const registryEntries = ref([makeEntry('hash-A')])
      mockRegistry.mockReturnValue({
        entries: computed(() => registryEntries.value)
      })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      seedRegistry(metaStore, ['hash-A'])
      filterStore.setWorkflow('fp-abc')
      const { entries: filtered } = useMoshpitFilteredAssets()
      expect(filtered.value).toHaveLength(1)
      expect(filtered.value[0].contentHash).toBe('hash-A')
    })
  })

  describe('FILTER-11: showHidden', () => {
    it('hidden assets are excluded by default (showHidden=false)', () => {
      const registryEntries = ref([
        makeEntry('hash-hidden'),
        makeEntry('hash-visible')
      ])
      mockRegistry.mockReturnValue({
        entries: computed(() => registryEntries.value)
      })
      const metaStore = useMoshpitMetadataStore()
      const curationStore = useMoshpitCurationStore()
      const filterStore = useMoshpitFilterStore()
      seedRegistry(metaStore, ['hash-hidden', 'hash-visible'])
      seedCuration(curationStore, 'hash-hidden', { hidden: true })
      filterStore.setWorkflow('fp-abc')

      const { entries: filtered } = useMoshpitFilteredAssets()
      const hashes = filtered.value.map((e) => e.contentHash)
      expect(hashes).not.toContain('hash-hidden')
      expect(hashes).toContain('hash-visible')
    })

    it('showHidden=true admits hidden assets', () => {
      const registryEntries = ref([makeEntry('hash-hidden')])
      mockRegistry.mockReturnValue({
        entries: computed(() => registryEntries.value)
      })
      const metaStore = useMoshpitMetadataStore()
      const curationStore = useMoshpitCurationStore()
      const filterStore = useMoshpitFilterStore()
      seedRegistry(metaStore, ['hash-hidden'])
      seedCuration(curationStore, 'hash-hidden', { hidden: true })
      filterStore.setWorkflow('fp-abc')
      filterStore.setShowHidden(true)

      const { entries: filtered } = useMoshpitFilteredAssets()
      expect(filtered.value.map((e) => e.contentHash)).toContain('hash-hidden')
    })
  })

  describe('FILTER-08: subtractive filtering', () => {
    it('adding a chip reduces entries', () => {
      const registryEntries = ref([
        makeEntry('hash-euler'),
        makeEntry('hash-dpm')
      ])
      mockRegistry.mockReturnValue({
        entries: computed(() => registryEntries.value)
      })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      metaStore.setParams('hash-euler', makeParams({ sampler: 'euler' }))
      metaStore.setParams('hash-dpm', makeParams({ sampler: 'dpmpp_2m' }))
      filterStore.setWorkflow('fp-abc')

      const { entries: filtered } = useMoshpitFilteredAssets()
      expect(filtered.value).toHaveLength(2)

      filterStore.addChip({
        id: 'chip-sampler',
        param: 'sampler',
        value: { kind: 'categorical', values: ['euler'] }
      })
      expect(filtered.value).toHaveLength(1)
      expect(filtered.value[0].contentHash).toBe('hash-euler')
    })

    it('adding a filter chip does not change cluster structure (GROUP-09 — filters cull, groups organise)', () => {
      const registryEntries = ref([
        makeEntry('hash-a'),
        makeEntry('hash-b'),
        makeEntry('hash-c')
      ])
      mockRegistry.mockReturnValue({
        entries: computed(() => registryEntries.value)
      })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      metaStore.setParams('hash-a', makeParams({ model: 'sd_xl' }))
      metaStore.setParams('hash-b', makeParams({ model: 'sd_xl' }))
      metaStore.setParams('hash-c', makeParams({ model: 'sd_15' }))
      filterStore.setWorkflow('fp-abc')
      filterStore.toggleGrouping('model')

      const { clusterTree } = useMoshpitFilteredAssets()
      const bucketsBefore = clusterTree.value?.children.length ?? 0
      expect(bucketsBefore).toBe(2)

      filterStore.addChip({
        id: 'chip-model',
        param: 'model',
        value: { kind: 'categorical', values: ['sd_xl'] }
      })
      // The filter culls hash-c → only one bucket remains, but the grouping
      // STRUCTURE (grouping by model) is preserved. The cluster tree still
      // reports a single model bucket child with two leaves.
      const bucketsAfter = clusterTree.value?.children.length ?? 0
      expect(bucketsAfter).toBe(1)
    })
  })

  describe('GROUP-09: empty activeGroupings → flat grid (single leaf cluster)', () => {
    it('entries populate worldX/worldY via clusterLayout empty-groupings path', () => {
      const registryEntries = ref([makeEntry('hash-A'), makeEntry('hash-B')])
      mockRegistry.mockReturnValue({
        entries: computed(() => registryEntries.value)
      })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      seedRegistry(metaStore, ['hash-A', 'hash-B'])
      filterStore.setWorkflow('fp-abc')

      const { entries: filtered, clusterTree } = useMoshpitFilteredAssets()
      expect(filtered.value).toHaveLength(2)
      for (const e of filtered.value) {
        expect(typeof e.worldX).toBe('number')
        expect(typeof e.worldY).toBe('number')
        expect(Number.isFinite(e.worldX)).toBe(true)
        expect(Number.isFinite(e.worldY)).toBe(true)
      }
      // Single-leaf root when no active groupings
      expect(clusterTree.value).not.toBeNull()
      expect(clusterTree.value!.children).toHaveLength(0)
      expect(clusterTree.value!.leafHashes).toHaveLength(2)
    })
  })

  describe('GROUP-01 single grouping axis', () => {
    it('one grouping axis produces children count = unique bucket count; leaves sum to filtered count', () => {
      const registryEntries = ref([
        makeEntry('hash-a'),
        makeEntry('hash-b'),
        makeEntry('hash-c'),
        makeEntry('hash-d')
      ])
      mockRegistry.mockReturnValue({
        entries: computed(() => registryEntries.value)
      })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      metaStore.setParams('hash-a', makeParams({ model: 'sd_xl' }))
      metaStore.setParams('hash-b', makeParams({ model: 'sd_xl' }))
      metaStore.setParams('hash-c', makeParams({ model: 'sd_15' }))
      metaStore.setParams('hash-d', makeParams({ model: 'flux' }))
      filterStore.setWorkflow('fp-abc')
      filterStore.toggleGrouping('model')

      const { entries: filtered, clusterTree } = useMoshpitFilteredAssets()
      expect(filtered.value).toHaveLength(4)
      expect(clusterTree.value).not.toBeNull()
      expect(clusterTree.value!.children).toHaveLength(3)
      const totalLeaves = clusterTree.value!.children.reduce(
        (sum, child) => sum + child.leafHashes.length,
        0
      )
      expect(totalLeaves).toBe(4)
    })
  })

  describe('GROUP-03 auto-nesting with two axes', () => {
    it('outer axis is the one with larger average bucket size (computeNestingOrder heuristic)', () => {
      const registryEntries = ref([
        makeEntry('h1'),
        makeEntry('h2'),
        makeEntry('h3'),
        makeEntry('h4'),
        makeEntry('h5'),
        makeEntry('h6')
      ])
      mockRegistry.mockReturnValue({
        entries: computed(() => registryEntries.value)
      })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      // 2 models × 3 prompts → model has larger avg bucket (6/2=3) than prompt
      // (6/3=2), so 'model' nests outermost.
      metaStore.setParams('h1', makeParams({ model: 'A', positivePrompt: 'p1' }))
      metaStore.setParams('h2', makeParams({ model: 'A', positivePrompt: 'p2' }))
      metaStore.setParams('h3', makeParams({ model: 'A', positivePrompt: 'p3' }))
      metaStore.setParams('h4', makeParams({ model: 'B', positivePrompt: 'p1' }))
      metaStore.setParams('h5', makeParams({ model: 'B', positivePrompt: 'p2' }))
      metaStore.setParams('h6', makeParams({ model: 'B', positivePrompt: 'p3' }))
      filterStore.setWorkflow('fp-abc')
      filterStore.toggleGrouping('prompt')
      filterStore.toggleGrouping('model')

      const { activeGroupingOrder, clusterTree } = useMoshpitFilteredAssets()
      expect(activeGroupingOrder.value[0]).toBe('model')
      expect(activeGroupingOrder.value[1]).toBe('prompt')
      // 2 model buckets at outer level
      expect(clusterTree.value?.children).toHaveLength(2)
    })
  })

  describe('CSORT-01 within-cluster sort', () => {
    it('changing withinClusterSort reorders leaf hashes without changing cluster structure', () => {
      const registryEntries = ref([
        makeEntry('hash-a'),
        makeEntry('hash-b'),
        makeEntry('hash-c')
      ])
      mockRegistry.mockReturnValue({
        entries: computed(() => registryEntries.value)
      })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      // Same model for all → single cluster, but different timestamps so
      // within-cluster sort has something to reorder.
      metaStore.setParams(
        'hash-a',
        makeParams({ model: 'sd_xl', timestamp: 3000 })
      )
      metaStore.setParams(
        'hash-b',
        makeParams({ model: 'sd_xl', timestamp: 1000 })
      )
      metaStore.setParams(
        'hash-c',
        makeParams({ model: 'sd_xl', timestamp: 2000 })
      )
      filterStore.setWorkflow('fp-abc')
      filterStore.toggleGrouping('model')

      const { clusterTree } = useMoshpitFilteredAssets()
      const structureBefore = clusterTree.value?.children.length
      const leavesNewest = clusterTree.value?.children[0]?.leafHashes ?? []

      filterStore.setWithinClusterSort('oldestFirst')
      const leavesOldest = clusterTree.value?.children[0]?.leafHashes ?? []

      // Structure (number of clusters) unchanged
      expect(clusterTree.value?.children.length).toBe(structureBefore)
      // Order flipped: newest-first's first hash should differ from
      // oldest-first's first hash in a population with distinct timestamps
      expect(leavesNewest[0]).not.toBe(leavesOldest[0])
      // Leaf membership preserved
      expect([...leavesNewest].sort()).toEqual([...leavesOldest].sort())
    })
  })
})
