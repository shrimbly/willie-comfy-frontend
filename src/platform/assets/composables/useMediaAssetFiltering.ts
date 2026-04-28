import { refDebounced } from '@vueuse/core'
import { sortBy as sortByUtil } from 'es-toolkit'
import Fuse from 'fuse.js'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type {
  DatePreset,
  MetadataFilter
} from '@/platform/assets/types/metadataFilter'
import {
  DATE_PRESETS,
  getDateRangeForPreset
} from '@/platform/assets/types/metadataFilter'
import type { PromptMetadata } from '@/platform/assets/utils/promptMetadataParser'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

type SortOption = 'newest' | 'oldest' | 'longest' | 'fastest'

/**
 * Get timestamp from asset (either create_time or created_at)
 */
const getAssetTime = (asset: AssetItem): number => {
  return (
    (asset.user_metadata?.create_time as number) ??
    (asset.created_at ? new Date(asset.created_at).getTime() : 0)
  )
}

/**
 * Get execution time from asset user_metadata
 */
const getAssetExecutionTime = (asset: AssetItem): number => {
  return (asset.user_metadata?.executionTimeInSeconds as number) ?? 0
}

function matchDateFilter(asset: AssetItem, value: string): boolean {
  const assetTime = getAssetTime(asset)
  if (assetTime === 0) return false

  if ((DATE_PRESETS as string[]).includes(value)) {
    const { start, end } = getDateRangeForPreset(value as DatePreset)
    return assetTime >= start.getTime() && assetTime < end.getTime()
  }

  const parsed = Date.parse(value)
  if (!Number.isNaN(parsed)) {
    const dayStart = new Date(parsed)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    return assetTime >= dayStart.getTime() && assetTime < dayEnd.getTime()
  }

  return false
}

export interface MetadataExtractor {
  getCached: (assetId: string) => PromptMetadata | null
}

interface UseMediaAssetFilteringOptions {
  metadataExtractor?: MetadataExtractor
  searchQuery?: Ref<string>
  metadataFilters?: Ref<MetadataFilter[]>
  mediaTypeFilters?: Ref<string[]>
}

/**
 * Media Asset Filtering composable
 * Manages search, filter, and sort for media assets
 */
export function useMediaAssetFiltering(
  assets: Ref<AssetItem[]>,
  options: UseMediaAssetFilteringOptions = {}
) {
  const searchQuery = options.searchQuery ?? ref('')
  const debouncedSearchQuery = refDebounced(searchQuery, 50)
  const sortBy = ref<SortOption>('newest')
  const mediaTypeFilters = options.mediaTypeFilters ?? ref<string[]>([])
  const metadataFilters = options.metadataFilters ?? ref<MetadataFilter[]>([])

  const fuseOptions = {
    keys: ['display_name', 'name'],
    threshold: 0.4,
    includeScore: true
  }

  const metadataFiltered = computed(() => {
    if (metadataFilters.value.length === 0) return assets.value

    return assets.value.filter((asset) => {
      return metadataFilters.value.every((filter) => {
        if (filter.field === 'date') {
          return matchDateFilter(asset, filter.value)
        }

        if (filter.field === 'favorite') {
          const tag = `favorite-${filter.value}`
          return asset.tags?.includes(tag) ?? false
        }

        if (filter.field === 'tag') {
          return asset.tags?.some((t) =>
            t.toLowerCase().includes(filter.value.toLowerCase())
          )
        }

        if (filter.field === 'type') {
          const mediaType = getMediaTypeFromFilename(asset.name)
          return mediaType.toLowerCase() === filter.value.toLowerCase()
        }

        const extractor = options.metadataExtractor
        if (!extractor) return false

        const metadata = extractor.getCached(asset.id)
        if (!metadata) return false

        const fieldValue = metadata[filter.field as keyof PromptMetadata]
        if (!fieldValue) return false
        return String(fieldValue)
          .toLowerCase()
          .includes(filter.value.toLowerCase())
      })
    })
  })

  const fuse = computed(() => new Fuse(metadataFiltered.value, fuseOptions))

  const searchFiltered = computed(() => {
    if (!debouncedSearchQuery.value.trim()) {
      return metadataFiltered.value
    }

    const results = fuse.value.search(debouncedSearchQuery.value)
    return results.map((result) => result.item)
  })

  const typeFiltered = computed(() => {
    if (mediaTypeFilters.value.length === 0) {
      return searchFiltered.value
    }

    return searchFiltered.value.filter((asset) => {
      const mediaType = getMediaTypeFromFilename(asset.name)
      const normalizedType = mediaType.toLowerCase()
      return mediaTypeFilters.value.includes(normalizedType)
    })
  })

  const filteredAssets = computed(() => {
    switch (sortBy.value) {
      case 'oldest':
        return sortByUtil(typeFiltered.value, [getAssetTime])
      case 'longest':
        return sortByUtil(typeFiltered.value, [
          (asset) => -getAssetExecutionTime(asset)
        ])
      case 'fastest':
        return sortByUtil(typeFiltered.value, [getAssetExecutionTime])
      case 'newest':
      default:
        return sortByUtil(typeFiltered.value, [(asset) => -getAssetTime(asset)])
    }
  })

  return {
    searchQuery,
    sortBy,
    mediaTypeFilters,
    metadataFilters,
    filteredAssets
  }
}
