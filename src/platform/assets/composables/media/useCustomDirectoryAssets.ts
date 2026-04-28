import { ref } from 'vue'
import type { Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  isMediaFile,
  navigateIntoDirectory,
  pickDirectory,
  readDirectoryHandle
} from '@/utils/directoryPickerUtil'
import type {
  DirectoryPickerResult,
  FileItem,
  FolderItem
} from '@/utils/directoryPickerUtil'

import type { IAssetsProvider } from './IAssetsProvider'

interface DirectoryNavigationState {
  rootPath: string | null
  currentPath: string
  history: string[]
  historyIndex: number
  directoryHandle: FileSystemDirectoryHandle | null
  rootHandle: FileSystemDirectoryHandle | null
}

/**
 * Convert FileItem to AssetItem
 */
function fileItemToAssetItem(file: FileItem, index: number): AssetItem {
  return {
    id: `custom-${file.path}-${index}`,
    name: file.name,
    asset_hash: file.path,
    mime_type: file.mimeType || 'application/octet-stream',
    size: file.size,
    created_at: file.lastModified
      ? new Date(file.lastModified).toISOString()
      : undefined,
    tags: ['custom'],
    preview_url: file.blobUrl,
    thumbnail_url: file.blobUrl,
    user_metadata: {
      source: 'custom-directory',
      fullPath: file.path
    }
  }
}

/**
 * Composable for browsing custom directories
 */
export function useCustomDirectoryAssets(): IAssetsProvider & {
  folders: Ref<FolderItem[]>
  navigationState: Ref<DirectoryNavigationState>
  selectDirectory: () => Promise<void>
  navigateInto: (folderName: string) => Promise<void>
  navigateToRoot: () => Promise<void>
  navigateUp: () => Promise<void>
  navigateBack: () => Promise<void>
  navigateForward: () => Promise<void>
  canNavigateBack: Ref<boolean>
  canNavigateForward: Ref<boolean>
  canNavigateUp: Ref<boolean>
} {
  const media = ref<AssetItem[]>([])
  const folders = ref<FolderItem[]>([])
  const loading = ref(false)
  const error = ref<unknown>(null)
  const hasMore = ref(false)
  const isLoadingMore = ref(false)

  const navigationState = ref<DirectoryNavigationState>({
    rootPath: null,
    currentPath: '',
    history: [],
    historyIndex: -1,
    directoryHandle: null,
    rootHandle: null
  })

  const canNavigateBack = ref(false)
  const canNavigateForward = ref(false)
  const canNavigateUp = ref(false)

  const updateNavigationFlags = () => {
    canNavigateBack.value = navigationState.value.historyIndex > 0
    canNavigateForward.value =
      navigationState.value.historyIndex <
      navigationState.value.history.length - 1
    canNavigateUp.value =
      navigationState.value.currentPath !== navigationState.value.rootPath &&
      navigationState.value.currentPath !== ''
  }

  const processDirectoryResult = (result: DirectoryPickerResult) => {
    // Filter to only media files
    const mediaFiles = result.files.filter((file) => isMediaFile(file.name))

    media.value = mediaFiles.map((file, index) =>
      fileItemToAssetItem(file, index)
    )
    folders.value = result.folders

    // Update navigation state
    navigationState.value.directoryHandle = result.handle

    error.value = null
  }

  const addToHistory = (path: string) => {
    // Remove any forward history if we're not at the end
    if (
      navigationState.value.historyIndex <
      navigationState.value.history.length - 1
    ) {
      navigationState.value.history = navigationState.value.history.slice(
        0,
        navigationState.value.historyIndex + 1
      )
    }

    navigationState.value.history.push(path)
    navigationState.value.historyIndex =
      navigationState.value.history.length - 1
    updateNavigationFlags()
  }

  /**
   * Open directory picker and load initial contents
   */
  const selectDirectory = async () => {
    loading.value = true
    error.value = null

    try {
      const result = await pickDirectory()

      processDirectoryResult(result)

      navigationState.value.rootPath = result.path
      navigationState.value.rootHandle = result.handle
      navigationState.value.currentPath = result.path
      navigationState.value.history = [result.path]
      navigationState.value.historyIndex = 0

      updateNavigationFlags()
    } catch (err) {
      console.error('Error selecting directory:', err)
      error.value = err
      media.value = []
      folders.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Navigate into a subfolder
   */
  const navigateInto = async (folderName: string) => {
    if (!navigationState.value.directoryHandle) {
      console.error('No directory handle available')
      return
    }

    loading.value = true
    error.value = null

    try {
      const result = await navigateIntoDirectory(
        navigationState.value.directoryHandle,
        folderName
      )

      processDirectoryResult(result)

      const newPath = `${navigationState.value.currentPath}/${folderName}`
      navigationState.value.currentPath = newPath
      addToHistory(newPath)
    } catch (err) {
      console.error('Error navigating into folder:', err)
      error.value = err
    } finally {
      loading.value = false
    }
  }

  /**
   * Navigate back to the root directory
   */
  const navigateToRoot = async () => {
    if (!navigationState.value.rootHandle || !navigationState.value.rootPath) {
      return
    }

    loading.value = true
    error.value = null

    try {
      const result = await readDirectoryHandle(navigationState.value.rootHandle)

      processDirectoryResult(result)

      navigationState.value.currentPath = navigationState.value.rootPath
      addToHistory(navigationState.value.rootPath)
    } catch (err) {
      console.error('Error navigating to root:', err)
      error.value = err
    } finally {
      loading.value = false
    }
  }

  /**
   * Navigate to parent directory
   */
  const navigateUp = async () => {
    if (!canNavigateUp.value || !navigationState.value.directoryHandle) {
      return
    }

    const pathParts = navigationState.value.currentPath.split('/')
    if (pathParts.length <= 1) return

    // Navigate to parent by going back through history or creating new navigation
    // This is a simplified implementation - full implementation would require
    // maintaining parent directory handles
    console.warn(
      'Navigate up functionality requires parent directory handle tracking'
    )
  }

  /**
   * Navigate back in history
   */
  const navigateBack = async () => {
    if (!canNavigateBack.value) return

    navigationState.value.historyIndex--
    const targetPath =
      navigationState.value.history[navigationState.value.historyIndex]
    navigationState.value.currentPath = targetPath
    updateNavigationFlags()

    // Note: Full implementation would reload directory contents for target path
    // This requires maintaining directory handles for each path in history
  }

  /**
   * Navigate forward in history
   */
  const navigateForward = async () => {
    if (!canNavigateForward.value) return

    navigationState.value.historyIndex++
    const targetPath =
      navigationState.value.history[navigationState.value.historyIndex]
    navigationState.value.currentPath = targetPath
    updateNavigationFlags()

    // Note: Full implementation would reload directory contents for target path
  }

  /**
   * Fetch/refresh media list
   */
  const fetchMediaList = async (): Promise<AssetItem[]> => {
    // For custom directory, this would refresh the current directory
    // Implementation depends on whether we have a directory handle
    return media.value
  }

  /**
   * Refresh current directory
   */
  const refresh = async (): Promise<AssetItem[]> => {
    return fetchMediaList()
  }

  /**
   * Load more items (pagination)
   * Not applicable for directory browsing
   */
  const loadMore = async (): Promise<void> => {
    // No pagination for local directory browsing
    return
  }

  return {
    // IAssetsProvider interface
    media,
    allMedia: media,
    loading,
    error,
    fetchMediaList,
    refresh,
    loadMore,
    hasMore,
    isLoadingMore,

    // Custom directory specific
    folders,
    navigationState,
    selectDirectory,
    navigateInto,
    navigateToRoot,
    navigateUp,
    navigateBack,
    navigateForward,
    canNavigateBack,
    canNavigateForward,
    canNavigateUp
  }
}
