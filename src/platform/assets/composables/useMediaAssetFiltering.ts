import { refDebounced } from '@vueuse/core'
import { sortBy as sortByUtil } from 'es-toolkit'
import Fuse from 'fuse.js'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { MetadataFilter } from '@/platform/assets/types/metadataFilter'
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

export interface MetadataExtractor {
  getCached: (assetId: string) => PromptMetadata | null
}

interface UseMediaAssetFilteringOptions {
  metadataExtractor?: MetadataExtractor
}

/**
 * Media Asset Filtering composable
 * Manages search, filter, and sort for media assets
 */
export function useMediaAssetFiltering(
  assets: Ref<AssetItem[]>,
  options: UseMediaAssetFilteringOptions = {}
) {
  const searchQuery = ref('')
  const debouncedSearchQuery = refDebounced(searchQuery, 50)
  const sortBy = ref<SortOption>('newest')
  const mediaTypeFilters = ref<string[]>([])
  const metadataFilters = ref<MetadataFilter[]>([])

  const fuseOptions = {
    keys: ['display_name', 'name'],
    threshold: 0.4,
    includeScore: true
  }

  const metadataFiltered = computed(() => {
    if (metadataFilters.value.length === 0) return assets.value

    const extractor = options.metadataExtractor
    if (!extractor) return assets.value

    return assets.value.filter((asset) => {
      const metadata = extractor.getCached(asset.id)
      if (!metadata) return false

      return metadataFilters.value.every((filter) => {
        const fieldValue = metadata[filter.field]
        if (!fieldValue) return false
        return fieldValue.toLowerCase().includes(filter.value.toLowerCase())
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
