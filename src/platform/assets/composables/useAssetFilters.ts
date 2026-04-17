import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

export interface DateRange {
  start: Date
  end: Date
}

export function useAssetFilters(assets: Ref<AssetItem[]>) {
  const dateRange = ref<[Date, Date] | null>(null)

  /**
   * Filter assets by creation date range
   */
  const filteredByDate = computed(() => {
    if (!dateRange.value || dateRange.value.length !== 2) {
      return assets.value
    }

    const [start, end] = dateRange.value

    // Set start to beginning of day
    const startDate = new Date(start)
    startDate.setHours(0, 0, 0, 0)

    // Set end to end of day
    const endDate = new Date(end)
    endDate.setHours(23, 59, 59, 999)

    return assets.value.filter((asset) => {
      if (!asset.created_at) return false

      const assetDate = new Date(asset.created_at)
      return assetDate >= startDate && assetDate <= endDate
    })
  })

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = computed(() => {
    return dateRange.value !== null && dateRange.value.length === 2
  })

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    dateRange.value = null
  }

  /**
   * Clear specific filter
   */
  const clearDateFilter = () => {
    dateRange.value = null
  }

  return {
    // State
    dateRange,

    // Computed
    filteredByDate,
    hasActiveFilters,

    // Actions
    clearFilters,
    clearDateFilter
  }
}
