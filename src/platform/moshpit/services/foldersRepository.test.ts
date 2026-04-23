import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('foldersRepository (fake-indexeddb)', () => {
  beforeEach(async () => {
    const { deleteMoshpitDB } = await import('./thumbRepository')
    await deleteMoshpitDB()
  })

  const sampleFolder = {
    id: 'folder-uuid-1',
    name: 'Shortlist A',
    createdAt: 1700000000000
  }

  it('saveFolder + loadAllFolders round-trips a FolderRecord', async () => {
    const { saveFolder, loadAllFolders } = await import('./foldersRepository')
    await saveFolder(sampleFolder)
    const all = await loadAllFolders()
    expect(all).toHaveLength(1)
    expect(all[0]).toEqual(sampleFolder)
  })

  it('saveFolder replaces an existing folder with the same id', async () => {
    const { saveFolder, loadAllFolders } = await import('./foldersRepository')
    await saveFolder(sampleFolder)
    await saveFolder({ ...sampleFolder, name: 'Renamed A' })
    const all = await loadAllFolders()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Renamed A')
  })

  it('deleteFolder removes only the targeted folder', async () => {
    const { saveFolder, deleteFolder, loadAllFolders } =
      await import('./foldersRepository')
    const f2 = { id: 'folder-uuid-2', name: 'B', createdAt: 1700000000001 }
    await saveFolder(sampleFolder)
    await saveFolder(f2)
    await deleteFolder('folder-uuid-1')
    const all = await loadAllFolders()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('folder-uuid-2')
  })

  it('clearAllFolders leaves the store empty', async () => {
    const { saveFolder, clearAllFolders, loadAllFolders } =
      await import('./foldersRepository')
    await saveFolder(sampleFolder)
    await saveFolder({ id: 'folder-uuid-2', name: 'B', createdAt: 2 })
    await clearAllFolders()
    expect(await loadAllFolders()).toHaveLength(0)
  })

  it('loadAllFolders on a fresh DB returns []', async () => {
    const { loadAllFolders } = await import('./foldersRepository')
    expect(await loadAllFolders()).toEqual([])
  })

  describe('malformed record filtering', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      warnSpy.mockRestore()
    })

    it('loadAllFolders skips a record with a non-string id and console.warns', async () => {
      const { openMoshpitDB } = await import('./thumbRepository')
      const { saveFolder, loadAllFolders } = await import('./foldersRepository')
      await saveFolder(sampleFolder)

      // Manually insert a malformed record (id is a number — invalid)
      const db = await openMoshpitDB()
      const tx = db.transaction('folders', 'readwrite')
      await tx.store.put({
        id: 'bad-createdAt',
        name: 'bad',
        createdAt: 'not-a-number'
      } as never)
      await tx.done

      const all = await loadAllFolders()
      expect(all).toHaveLength(1)
      expect(all[0].id).toBe('folder-uuid-1')
      expect(warnSpy).toHaveBeenCalled()
    })
  })
})
