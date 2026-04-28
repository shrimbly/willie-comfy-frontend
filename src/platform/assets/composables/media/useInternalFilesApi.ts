import { computed } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsStore } from '@/stores/assetsStore'

import { useFolderNavigation } from './useFolderNavigation'

/**
 * Composable for fetching media assets from local environment
 * Uses AssetsStore for centralized state management
 */
export function useInternalFilesApi(directory: 'input' | 'output') {
  const assetsStore = useAssetsStore()

  const allMedia = computed(() =>
    directory === 'input' ? assetsStore.inputAssets : assetsStore.historyAssets
  )

  const loading = computed(() =>
    directory === 'input'
      ? assetsStore.inputLoading
      : assetsStore.historyLoading
  )

  const error = computed(() =>
    directory === 'input' ? assetsStore.inputError : assetsStore.historyError
  )

  const fetchMediaList = async (): Promise<AssetItem[]> => {
    if (directory === 'input') {
      await assetsStore.updateInputs()
      return assetsStore.inputAssets
    } else {
      await assetsStore.updateHistory()
      return assetsStore.historyAssets
    }
  }

  const refresh = () => fetchMediaList()

  const loadMore = async (): Promise<void> => {
    // No pagination — all files fetched in one request
  }

  const hasMore = computed(() => false)

  const isLoadingMore = computed(() => false)

  // Folder navigation for virtual directories parsed from filenames
  const {
    folders,
    filteredMedia,
    currentPath,
    navigateInto,
    navigateUp,
    navigateToRoot,
    navigateToPath,
    canNavigateUp,
    canNavigateBack,
    canNavigateForward,
    navigateBack,
    navigateForward
  } = useFolderNavigation(() => allMedia.value)

  // media returns filtered assets based on current folder path
  const media = computed(() => filteredMedia.value)

  return {
    media,
    allMedia,
    loading,
    error,
    fetchMediaList,
    refresh,
    loadMore,
    hasMore,
    isLoadingMore,
    folders,
    currentPath,
    navigateInto,
    navigateUp,
    navigateToRoot,
    navigateToPath,
    canNavigateUp,
    canNavigateBack,
    canNavigateForward,
    navigateBack,
    navigateForward
  }
}
