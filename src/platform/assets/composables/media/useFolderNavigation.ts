import { computed, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  filterFilesInFolder,
  parseFoldersFromFilenames
} from '@/platform/assets/utils/folderParser'
import type { FolderItem } from '@/utils/directoryPickerUtil'

/**
 * Composable for folder navigation within flat filename-based asset lists.
 * Parses virtual folder structure from filenames containing path separators.
 */
export function useFolderNavigation(allAssets: () => AssetItem[]) {
  const currentPath = ref<string>('')
  const navigationHistory = ref<string[]>([])
  const historyIndex = ref(-1)

  const folders = computed(() => {
    const filenames = allAssets().map((asset) => asset.name)
    return parseFoldersFromFilenames(filenames, currentPath.value)
  })

  const filteredMedia = computed(() => {
    const assets = allAssets()
    const filenames = filterFilesInFolder(
      assets.map((a) => a.name),
      currentPath.value
    )
    const filenameSet = new Set(filenames)
    return assets.filter((asset) => filenameSet.has(asset.name))
  })

  const navigateInto = (folder: FolderItem) => {
    if (historyIndex.value < navigationHistory.value.length - 1) {
      navigationHistory.value = navigationHistory.value.slice(
        0,
        historyIndex.value + 1
      )
    }
    navigationHistory.value.push(folder.path)
    historyIndex.value = navigationHistory.value.length - 1
    currentPath.value = folder.path
  }

  const navigateUp = () => {
    if (!currentPath.value) return
    const parts = currentPath.value.split('/')
    parts.pop()
    const newPath = parts.join('/')
    navigationHistory.value.push(newPath)
    historyIndex.value = navigationHistory.value.length - 1
    currentPath.value = newPath
  }

  const navigateToRoot = () => {
    navigationHistory.value.push('')
    historyIndex.value = navigationHistory.value.length - 1
    currentPath.value = ''
  }

  const canNavigateUp = computed(() => currentPath.value !== '')

  const canNavigateBack = computed(() => historyIndex.value > 0)

  const canNavigateForward = computed(
    () => historyIndex.value < navigationHistory.value.length - 1
  )

  const navigateBack = () => {
    if (!canNavigateBack.value) return
    historyIndex.value--
    currentPath.value = navigationHistory.value[historyIndex.value]
  }

  const navigateForward = () => {
    if (!canNavigateForward.value) return
    historyIndex.value++
    currentPath.value = navigationHistory.value[historyIndex.value]
  }

  return {
    folders,
    filteredMedia,
    currentPath,
    navigateInto,
    navigateUp,
    navigateToRoot,
    canNavigateUp,
    canNavigateBack,
    canNavigateForward,
    navigateBack,
    navigateForward
  }
}
