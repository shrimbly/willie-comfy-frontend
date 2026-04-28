import { isCloud } from '@/platform/distribution/types'

import type { IAssetsProvider, IFolderNavigation } from './IAssetsProvider'
import { useAssetsApi } from './useAssetsApi'
import { useInternalFilesApi } from './useInternalFilesApi'

/**
 * Factory function that returns the appropriate media assets implementation
 * based on the current distribution (cloud vs internal)
 * @param directory - The directory to fetch assets from
 * @returns IAssetsProvider with folder navigation support
 */
export function useMediaAssets(
  directory: 'input' | 'output'
): IAssetsProvider & IFolderNavigation {
  return isCloud ? useAssetsApi(directory) : useInternalFilesApi(directory)
}
