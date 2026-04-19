import type { Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { FolderItem } from '@/utils/directoryPickerUtil'

/**
 * Interface for folder navigation within asset providers
 */
export interface IFolderNavigation {
  folders: Ref<FolderItem[]>
  currentPath: Ref<string>
  navigateInto: (folder: FolderItem) => void
  navigateUp: () => void
  navigateToRoot: () => void
  canNavigateUp: Ref<boolean>
  canNavigateBack: Ref<boolean>
  canNavigateForward: Ref<boolean>
  navigateBack: () => void
  navigateForward: () => void
}

/**
 * Interface for media assets providers
 * Defines the common API for both cloud and internal file implementations
 */
export interface IAssetsProvider {
  /** Current media assets (filtered by folder navigation) */
  media: Ref<AssetItem[]>

  /** All media assets regardless of folder navigation */
  allMedia: Ref<AssetItem[]>

  /** Loading state indicator */
  loading: Ref<boolean>

  /** Error state */
  error: Ref<unknown>

  /**
   * Fetch list of media assets
   * @returns Promise resolving to array of AssetItem
   */
  fetchMediaList: () => Promise<AssetItem[]>

  /**
   * Refresh the media list (alias for fetchMediaList)
   */
  refresh: () => Promise<AssetItem[]>

  /**
   * Load more items (for pagination)
   */
  loadMore: () => Promise<void>

  /**
   * Whether there are more items to load
   */
  hasMore: Ref<boolean>

  /**
   * Whether currently loading more items
   */
  isLoadingMore: Ref<boolean>
}
