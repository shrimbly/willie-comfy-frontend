import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import type { MetadataExtractor } from './useMediaAssetFiltering'
import { useMediaAssetFiltering } from './useMediaAssetFiltering'

function makeAsset(
  overrides: Partial<AssetItem> & { id: string; name: string }
): AssetItem {
  return {
    tags: [],
    ...overrides
  }
}

describe('useMediaAssetFiltering - date filter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Wednesday, 2025-03-12 14:30:00
    vi.setSystemTime(new Date(2025, 2, 12, 14, 30, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('filters assets by "today" preset', async () => {
    const todayAsset = makeAsset({
      id: '1',
      name: 'today.png',
      created_at: new Date(2025, 2, 12, 10, 0, 0).toISOString()
    })
    const yesterdayAsset = makeAsset({
      id: '2',
      name: 'yesterday.png',
      created_at: new Date(2025, 2, 11, 10, 0, 0).toISOString()
    })
    const assets = ref([todayAsset, yesterdayAsset])

    const { metadataFilters, filteredAssets } = useMediaAssetFiltering(assets)
    metadataFilters.value = [{ field: 'date', value: 'today' }]
    await nextTick()

    expect(filteredAssets.value.map((a) => a.id)).toEqual(['1'])
  })

  it('filters assets by "yesterday" preset', async () => {
    const todayAsset = makeAsset({
      id: '1',
      name: 'today.png',
      created_at: new Date(2025, 2, 12, 10, 0, 0).toISOString()
    })
    const yesterdayAsset = makeAsset({
      id: '2',
      name: 'yesterday.png',
      created_at: new Date(2025, 2, 11, 10, 0, 0).toISOString()
    })
    const assets = ref([todayAsset, yesterdayAsset])

    const { metadataFilters, filteredAssets } = useMediaAssetFiltering(assets)
    metadataFilters.value = [{ field: 'date', value: 'yesterday' }]
    await nextTick()

    expect(filteredAssets.value.map((a) => a.id)).toEqual(['2'])
  })

  it('filters assets by "thisWeek" preset', async () => {
    const thisWeekAsset = makeAsset({
      id: '1',
      name: 'week.png',
      created_at: new Date(2025, 2, 10, 10, 0, 0).toISOString()
    })
    const lastWeekAsset = makeAsset({
      id: '2',
      name: 'lastweek.png',
      created_at: new Date(2025, 2, 1, 10, 0, 0).toISOString()
    })
    const assets = ref([thisWeekAsset, lastWeekAsset])

    const { metadataFilters, filteredAssets } = useMediaAssetFiltering(assets)
    metadataFilters.value = [{ field: 'date', value: 'thisWeek' }]
    await nextTick()

    expect(filteredAssets.value.map((a) => a.id)).toEqual(['1'])
  })

  it('excludes assets with no timestamp', async () => {
    const noDateAsset = makeAsset({ id: '1', name: 'nodate.png' })
    const assets = ref([noDateAsset])

    const { metadataFilters, filteredAssets } = useMediaAssetFiltering(assets)
    metadataFilters.value = [{ field: 'date', value: 'today' }]
    await nextTick()

    expect(filteredAssets.value).toEqual([])
  })
})

describe('useMediaAssetFiltering - tag filter', () => {
  it('filters assets by tag', async () => {
    const outputAsset = makeAsset({
      id: '1',
      name: 'out.png',
      tags: ['output', 'favorite']
    })
    const inputAsset = makeAsset({
      id: '2',
      name: 'in.png',
      tags: ['input']
    })
    const assets = ref([outputAsset, inputAsset])

    const { metadataFilters, filteredAssets } = useMediaAssetFiltering(assets)
    metadataFilters.value = [{ field: 'tag', value: 'favorite' }]
    await nextTick()

    expect(filteredAssets.value.map((a) => a.id)).toEqual(['1'])
  })

  it('matches tags case-insensitively', async () => {
    const asset = makeAsset({
      id: '1',
      name: 'out.png',
      tags: ['Output']
    })
    const assets = ref([asset])

    const { metadataFilters, filteredAssets } = useMediaAssetFiltering(assets)
    metadataFilters.value = [{ field: 'tag', value: 'output' }]
    await nextTick()

    expect(filteredAssets.value.map((a) => a.id)).toEqual(['1'])
  })

  it('excludes assets with no tags', async () => {
    const asset = makeAsset({ id: '1', name: 'out.png', tags: [] })
    const assets = ref([asset])

    const { metadataFilters, filteredAssets } = useMediaAssetFiltering(assets)
    metadataFilters.value = [{ field: 'tag', value: 'output' }]
    await nextTick()

    expect(filteredAssets.value).toEqual([])
  })
})

describe('useMediaAssetFiltering - prompt metadata filter', () => {
  it('filters by prompt metadata field using extractor', async () => {
    const asset1 = makeAsset({ id: '1', name: 'a.png' })
    const asset2 = makeAsset({ id: '2', name: 'b.png' })
    const assets = ref([asset1, asset2])

    const extractor: MetadataExtractor = {
      getCached: (id: string) => {
        if (id === '1')
          return {
            model: 'sdxl.safetensors',
            lora: null,
            vae: null,
            prompt: null,
            steps: null,
            seed: null
          }
        return null
      }
    }

    const { metadataFilters, filteredAssets } = useMediaAssetFiltering(assets, {
      metadataExtractor: extractor
    })
    metadataFilters.value = [{ field: 'model', value: 'sdxl' }]
    await nextTick()

    expect(filteredAssets.value.map((a) => a.id)).toEqual(['1'])
  })
})

describe('useMediaAssetFiltering - combined filters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 2, 12, 14, 30, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('combines date and tag filters with AND logic', async () => {
    const asset1 = makeAsset({
      id: '1',
      name: 'a.png',
      tags: ['output'],
      created_at: new Date(2025, 2, 12, 10, 0, 0).toISOString()
    })
    const asset2 = makeAsset({
      id: '2',
      name: 'b.png',
      tags: ['input'],
      created_at: new Date(2025, 2, 12, 10, 0, 0).toISOString()
    })
    const asset3 = makeAsset({
      id: '3',
      name: 'c.png',
      tags: ['output'],
      created_at: new Date(2025, 2, 11, 10, 0, 0).toISOString()
    })
    const assets = ref([asset1, asset2, asset3])

    const { metadataFilters, filteredAssets } = useMediaAssetFiltering(assets)
    metadataFilters.value = [
      { field: 'date', value: 'today' },
      { field: 'tag', value: 'output' }
    ]
    await nextTick()

    expect(filteredAssets.value.map((a) => a.id)).toEqual(['1'])
  })
})
