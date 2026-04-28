/**
 * Cross-platform directory picker utility
 * Supports Electron, modern browsers with File System Access API, and fallback for older browsers
 */

export interface FileItem {
  name: string
  path: string
  type: 'file'
  mimeType?: string
  size?: number
  lastModified?: number
  blobUrl?: string
}

export interface FolderItem {
  name: string
  path: string
  type: 'folder'
  itemCount?: number
}

export interface DirectoryPickerResult {
  handle: FileSystemDirectoryHandle | null
  files: FileItem[]
  folders: FolderItem[]
  path: string
}

/**
 * Check if running in Electron environment
 */
interface ElectronAPI {
  showOpenDialog(options: {
    properties: string[]
  }): Promise<{ canceled: boolean; filePaths: string[] }>
  readDirectory(path: string): Promise<
    Array<{
      name: string
      path: string
      isDirectory: boolean
      itemCount?: number
      mimeType?: string
      size?: number
      lastModified?: number
    }>
  >
}

interface WindowWithExtensions {
  electronAPI?: ElectronAPI
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}

function getExtendedWindow(): WindowWithExtensions {
  return window as unknown as WindowWithExtensions
}

function isElectron(): boolean {
  return !!getExtendedWindow().electronAPI
}

/**
 * Check if File System Access API is supported
 */
function supportsFileSystemAccess(): boolean {
  return !!getExtendedWindow().showDirectoryPicker
}

/**
 * Check if media file (image, video, audio)
 */
export function isMediaFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop()
  const mediaExtensions = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'bmp',
    'svg',
    'mp4',
    'webm',
    'mov',
    'avi',
    'mp3',
    'wav',
    'ogg'
  ]
  return mediaExtensions.includes(ext || '')
}

/**
 * Iterate directory handle entries.
 * FileSystemDirectoryHandle iteration methods are not fully typed in TS DOM lib.
 */
interface IterableDirectoryHandle {
  entries(): AsyncIterableIterator<
    [string, FileSystemDirectoryHandle | FileSystemFileHandle]
  >
}

async function* iterateDirectory(
  handle: FileSystemDirectoryHandle
): AsyncGenerator<FileSystemDirectoryHandle | FileSystemFileHandle> {
  for await (const [, entry] of (
    handle as unknown as IterableDirectoryHandle
  ).entries()) {
    yield entry
  }
}

/**
 * Read the contents of a FileSystemDirectoryHandle
 */
export async function readDirectoryHandle(
  directoryHandle: FileSystemDirectoryHandle
): Promise<DirectoryPickerResult> {
  const files: FileItem[] = []
  const folders: FolderItem[] = []

  for await (const entry of iterateDirectory(directoryHandle)) {
    if (entry.kind === 'directory') {
      let itemCount = 0
      try {
        for await (const _ of iterateDirectory(
          entry as FileSystemDirectoryHandle
        )) {
          itemCount++
        }
      } catch (err) {
        console.warn(`Failed to count items in ${entry.name}:`, err)
      }

      folders.push({
        name: entry.name,
        path: entry.name,
        type: 'folder',
        itemCount
      })
    } else if (entry.kind === 'file') {
      const file = await (entry as FileSystemFileHandle).getFile()
      files.push({
        name: entry.name,
        path: entry.name,
        type: 'file',
        mimeType: file.type,
        size: file.size,
        lastModified: file.lastModified,
        blobUrl: isMediaFile(entry.name) ? URL.createObjectURL(file) : undefined
      })
    }
  }

  return {
    handle: directoryHandle,
    files,
    folders,
    path: directoryHandle.name
  }
}

/**
 * Pick directory using Electron's native dialog
 */
async function pickDirectoryElectron(): Promise<DirectoryPickerResult> {
  const electronAPI = getExtendedWindow().electronAPI
  if (!electronAPI) throw new Error('Electron API not available')

  const result = await electronAPI.showOpenDialog({
    properties: ['openDirectory']
  })

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    throw new Error('Directory selection cancelled')
  }

  const directoryPath = result.filePaths[0]

  // Read directory contents using Electron's fs
  const contents = await electronAPI.readDirectory(directoryPath)

  const files: FileItem[] = []
  const folders: FolderItem[] = []

  for (const item of contents) {
    if (item.isDirectory) {
      folders.push({
        name: item.name,
        path: item.path,
        type: 'folder',
        itemCount: item.itemCount
      })
    } else {
      files.push({
        name: item.name,
        path: item.path,
        type: 'file',
        mimeType: item.mimeType,
        size: item.size,
        lastModified: item.lastModified
      })
    }
  }

  return {
    handle: null,
    files,
    folders,
    path: directoryPath
  }
}

/**
 * Pick directory using File System Access API
 */
async function pickDirectoryBrowser(): Promise<DirectoryPickerResult> {
  const showDirectoryPicker = getExtendedWindow().showDirectoryPicker
  if (!showDirectoryPicker) {
    throw new Error('File System Access API not supported')
  }
  const directoryHandle = await showDirectoryPicker()
  return readDirectoryHandle(directoryHandle)
}

/**
 * Pick directory using fallback input method (webkitdirectory)
 * Note: This shows files only, not folder structure
 */
async function pickDirectoryFallback(): Promise<DirectoryPickerResult> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.multiple = true

    input.onchange = () => {
      if (!input.files || input.files.length === 0) {
        reject(new Error('No files selected'))
        return
      }

      const files: FileItem[] = []
      const folderSet = new Set<string>()

      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i]
        const relativePath =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name

        // Extract folder names from path
        const pathParts = relativePath.split('/')
        if (pathParts.length > 1) {
          // Add immediate parent folder
          const parentFolder = pathParts[pathParts.length - 2]
          folderSet.add(parentFolder)
        }

        files.push({
          name: file.name,
          path: relativePath,
          type: 'file',
          mimeType: file.type,
          size: file.size,
          lastModified: file.lastModified,
          blobUrl: isMediaFile(file.name)
            ? URL.createObjectURL(file)
            : undefined
        })
      }

      const folders: FolderItem[] = Array.from(folderSet).map((name) => ({
        name,
        path: name,
        type: 'folder'
      }))

      // Get root directory name from first file
      const rootPath =
        input.files.length > 0
          ? (
              (input.files[0] as File & { webkitRelativePath?: string })
                .webkitRelativePath || ''
            ).split('/')[0] || 'Selected Directory'
          : 'Selected Directory'

      resolve({
        handle: null,
        files,
        folders,
        path: rootPath
      })
    }

    input.oncancel = () => {
      reject(new Error('Directory selection cancelled'))
    }

    input.click()
  })
}

/**
 * Main directory picker function - automatically selects best method
 */
export async function pickDirectory(): Promise<DirectoryPickerResult> {
  if (isElectron()) {
    try {
      return await pickDirectoryElectron()
    } catch (e) {
      // Electron API failed — fall through to browser methods
    }
  }
  if (supportsFileSystemAccess()) {
    try {
      return await pickDirectoryBrowser()
    } catch (e) {
      // Rethrow user cancellations
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new Error('Directory selection cancelled')
      }
      // Other failures — fall through to fallback
    }
  }
  return pickDirectoryFallback()
}

/**
 * Navigate into a subdirectory using File System Access API handle
 */
export async function navigateIntoDirectory(
  parentHandle: FileSystemDirectoryHandle,
  folderName: string
): Promise<DirectoryPickerResult> {
  const directoryHandle = await parentHandle.getDirectoryHandle(folderName)
  return readDirectoryHandle(directoryHandle)
}
