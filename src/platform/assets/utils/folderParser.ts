import type { FolderItem } from '@/utils/directoryPickerUtil'

/**
 * Parse filenames to extract unique folders at the current path level
 * @param filenames Array of filenames (may include paths like "folder/file.png")
 * @param currentPath Current folder path (empty string = root)
 * @returns Array of folder items at the current level
 */
export function parseFoldersFromFilenames(
  filenames: string[],
  currentPath: string = ''
): FolderItem[] {
  const folderSet = new Set<string>()
  const prefix = currentPath ? currentPath + '/' : ''

  for (const filename of filenames) {
    // Only process files that start with current path
    if (currentPath && !filename.startsWith(prefix)) {
      continue
    }

    // Get the relative path from current location
    const relativePath = currentPath
      ? filename.substring(prefix.length)
      : filename

    // Check if this path contains a folder
    const firstSlash = relativePath.indexOf('/')
    if (firstSlash > 0) {
      const folderName = relativePath.substring(0, firstSlash)
      folderSet.add(folderName)
    }
  }

  // Convert set to FolderItem array
  return Array.from(folderSet).map((name) => {
    const folderPath = currentPath ? `${currentPath}/${name}` : name

    // Count items in this folder
    const itemCount = filenames.filter((f) =>
      f.startsWith(folderPath + '/')
    ).length

    return {
      name,
      path: folderPath,
      type: 'folder' as const,
      itemCount
    }
  })
}

/**
 * Filter filenames to only those in the current folder (non-recursive)
 * @param filenames All filenames
 * @param currentPath Current folder path (empty = root)
 * @returns Filenames that belong directly in current folder
 */
export function filterFilesInFolder(
  filenames: string[],
  currentPath: string = ''
): string[] {
  if (!currentPath) {
    // Root level: only files without '/'
    return filenames.filter((f) => !f.includes('/'))
  }

  const prefix = currentPath + '/'
  return filenames.filter((f) => {
    if (!f.startsWith(prefix)) return false

    const relativePath = f.substring(prefix.length)
    // Only include if no further slashes (direct child)
    return !relativePath.includes('/')
  })
}
