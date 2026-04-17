import { computed, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsStore } from '@/stores/assetsStore'

import type { IAssetsProvider, IFolderNavigation } from './IAssetsProvider'

/**
 * Provides the default Output-tab data source: one asset per completed job,
 * with generation-time metadata and paginated fetching. Folder navigation
 * is a no-op since this view groups by job (not by filesystem subfolder).
 */
export function useOutputJobsAssets(): IAssetsProvider & IFolderNavigation {
  const assetsStore = useAssetsStore()

  const media = computed<AssetItem[]>(() => assetsStore.outputJobAssets)
  const loading = computed<boolean>(() => assetsStore.outputJobsLoading)
  const error = computed<unknown>(() => assetsStore.outputJobsError)

  const fetchMediaList = async (): Promise<AssetItem[]> => {
    await assetsStore.updateOutputJobs()
    return assetsStore.outputJobAssets
  }

  const refresh = () => fetchMediaList()

  const loadMore = async (): Promise<void> => {
    await assetsStore.loadMoreOutputJobs()
  }

  const hasMore = computed<boolean>(() => assetsStore.outputJobsHasMore)
  const isLoadingMore = computed<boolean>(
    () => assetsStore.outputJobsLoadingMore
  )

  const folders = ref([])
  const currentPath = ref('')
  const canNavigateUp = ref(false)
  const canNavigateBack = ref(false)
  const canNavigateForward = ref(false)
  const noop = () => {}

  return {
    media,
    loading,
    error,
    fetchMediaList,
    refresh,
    loadMore,
    hasMore,
    isLoadingMore,
    folders,
    currentPath,
    navigateInto: noop,
    navigateUp: noop,
    navigateToRoot: noop,
    canNavigateUp,
    canNavigateBack,
    canNavigateForward,
    navigateBack: noop,
    navigateForward: noop
  }
}
