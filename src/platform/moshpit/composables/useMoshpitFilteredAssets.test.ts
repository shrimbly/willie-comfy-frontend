import { computed, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyParams } from '../services/paramNormalize'
import type { NormalizedParams } from '../services/paramNormalize'
import type { AssetMetaRecord, CurationRecord } from '../services/thumbRepository.types'
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

function makeParams(overrides: Partial<NormalizedParams> = {}): NormalizedParams {
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
  // Use the public load() API with a minimal AssetMetaRecord
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

  describe('axisMode', () => {
    it('returns "chaos" when sortX is null', () => {
      mockRegistry.mockReturnValue({ entries: computed(() => []) })
      const { axisMode } = useMoshpitFilteredAssets()
      expect(axisMode.value).toBe('chaos')
    })

    it('returns "1d" when sortX is set and sortY is null', () => {
      mockRegistry.mockReturnValue({ entries: computed(() => []) })
      const filterStore = useMoshpitFilterStore()
      filterStore.setSortX('cfg')
      const { axisMode } = useMoshpitFilteredAssets()
      expect(axisMode.value).toBe('1d')
    })

    it('returns "2d" when both sortX and sortY are set', () => {
      mockRegistry.mockReturnValue({ entries: computed(() => []) })
      const filterStore = useMoshpitFilterStore()
      filterStore.setSortX('cfg')
      filterStore.setSortY('steps')
      const { axisMode } = useMoshpitFilteredAssets()
      expect(axisMode.value).toBe('2d')
    })
  })

  describe('FILTER-01 gate', () => {
    it('entries is empty when workflow is null (not gated)', () => {
      const entries = ref([makeEntry('hash-A')])
      mockRegistry.mockReturnValue({ entries: computed(() => entries.value) })
      const metaStore = useMoshpitMetadataStore()
      seedRegistry(metaStore, ['hash-A'])
      // workflow is null by default — isGated = false
      const { entries: filtered } = useMoshpitFilteredAssets()
      expect(filtered.value).toHaveLength(0)
    })

    it('entries is non-empty once workflow is set', () => {
      const registryEntries = ref([makeEntry('hash-A')])
      mockRegistry.mockReturnValue({ entries: computed(() => registryEntries.value) })
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
      const registryEntries = ref([makeEntry('hash-hidden'), makeEntry('hash-visible')])
      mockRegistry.mockReturnValue({ entries: computed(() => registryEntries.value) })
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
      mockRegistry.mockReturnValue({ entries: computed(() => registryEntries.value) })
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
      mockRegistry.mockReturnValue({ entries: computed(() => registryEntries.value) })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      metaStore.setParams('hash-euler', makeParams({ sampler: 'euler' }))
      metaStore.setParams('hash-dpm', makeParams({ sampler: 'dpmpp_2m' }))
      filterStore.setWorkflow('fp-abc')

      const { entries: filtered } = useMoshpitFilteredAssets()
      // Before chip: both visible
      expect(filtered.value).toHaveLength(2)

      // Add chip: only euler
      filterStore.addChip({
        id: 'chip-sampler',
        param: 'sampler',
        value: { kind: 'categorical', values: ['euler'] }
      })
      expect(filtered.value).toHaveLength(1)
      expect(filtered.value[0].contentHash).toBe('hash-euler')
    })
  })

  describe('chaos layout', () => {
    it('entries have worldX and worldY defined (jittered-grid positions)', () => {
      const registryEntries = ref([makeEntry('hash-A'), makeEntry('hash-B')])
      mockRegistry.mockReturnValue({ entries: computed(() => registryEntries.value) })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      seedRegistry(metaStore, ['hash-A', 'hash-B'])
      filterStore.setWorkflow('fp-abc')

      const { entries: filtered } = useMoshpitFilteredAssets()
      expect(filtered.value).toHaveLength(2)
      for (const e of filtered.value) {
        expect(typeof e.worldX).toBe('number')
        expect(typeof e.worldY).toBe('number')
        expect(Number.isFinite(e.worldX)).toBe(true)
        expect(Number.isFinite(e.worldY)).toBe(true)
      }
    })

    it('columns is empty in chaos mode', () => {
      mockRegistry.mockReturnValue({ entries: computed(() => []) })
      const filterStore = useMoshpitFilterStore()
      filterStore.setWorkflow('fp-abc')
      const { columns } = useMoshpitFilteredAssets()
      expect(columns.value).toHaveLength(0)
    })
  })

  describe('SORT-01: 1D sort layout', () => {
    it('setting sortX changes entries to sorted positions', () => {
      const registryEntries = ref([
        makeEntry('hash-cfg7'),
        makeEntry('hash-cfg3')
      ])
      mockRegistry.mockReturnValue({ entries: computed(() => registryEntries.value) })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      metaStore.setParams('hash-cfg7', makeParams({ cfg: 7 }))
      metaStore.setParams('hash-cfg3', makeParams({ cfg: 3 }))
      filterStore.setWorkflow('fp-abc')
      filterStore.setSortX('cfg')

      const { entries: filtered, columns } = useMoshpitFilteredAssets()
      // Both assets should appear
      expect(filtered.value).toHaveLength(2)
      // columns should have 2 entries (one per unique cfg value)
      expect(columns.value).toHaveLength(2)
      // cfg=3 column comes before cfg=7 (numeric sort)
      expect(columns.value[0].paramValue).toBe('3')
      expect(columns.value[1].paramValue).toBe('7')
    })

    it('SORT-03: assets lacking sortX param are absent from entries', () => {
      const registryEntries = ref([
        makeEntry('hash-with-cfg'),
        makeEntry('hash-no-cfg')
      ])
      mockRegistry.mockReturnValue({ entries: computed(() => registryEntries.value) })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      metaStore.setParams('hash-with-cfg', makeParams({ cfg: 7 }))
      // hash-no-cfg has no cfg value (emptyParams has cfg: undefined)
      metaStore.setParams('hash-no-cfg', makeParams({ cfg: undefined }))
      filterStore.setWorkflow('fp-abc')
      filterStore.setSortX('cfg')

      const { entries: filtered } = useMoshpitFilteredAssets()
      expect(filtered.value).toHaveLength(1)
      expect(filtered.value[0].contentHash).toBe('hash-with-cfg')
    })
  })

  describe('SORT-02: 2D sort layout', () => {
    it('setting sortX + sortY produces 2D layout with rows and columns', () => {
      const registryEntries = ref([
        makeEntry('hash-a'),
        makeEntry('hash-b'),
        makeEntry('hash-c')
      ])
      mockRegistry.mockReturnValue({ entries: computed(() => registryEntries.value) })
      const metaStore = useMoshpitMetadataStore()
      const filterStore = useMoshpitFilterStore()
      metaStore.setParams('hash-a', makeParams({ cfg: 7, steps: 20 }))
      metaStore.setParams('hash-b', makeParams({ cfg: 7, steps: 30 }))
      metaStore.setParams('hash-c', makeParams({ cfg: 3, steps: 20 }))
      filterStore.setWorkflow('fp-abc')
      filterStore.setSortX('cfg')
      filterStore.setSortY('steps')

      const { entries: filtered, columns, rows } = useMoshpitFilteredAssets()
      expect(filtered.value).toHaveLength(3)
      expect(columns.value).toHaveLength(2) // cfg: 3, 7
      expect(rows.value).toHaveLength(2)    // steps: 20, 30
    })

    it('rows is empty in 1D mode', () => {
      mockRegistry.mockReturnValue({ entries: computed(() => []) })
      const filterStore = useMoshpitFilterStore()
      filterStore.setWorkflow('fp-abc')
      filterStore.setSortX('cfg')
      const { rows } = useMoshpitFilteredAssets()
      expect(rows.value).toHaveLength(0)
    })
  })
})
