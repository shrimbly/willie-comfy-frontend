import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { NormalizedParams } from '../services/paramNormalize'
import { useMoshpitCurationStore } from './moshpitCurationStore'
import { useMoshpitFoldersStore } from './moshpitFoldersStore'

const stubParams: NormalizedParams = {
  model: undefined,
  loras: [],
  cfg: undefined,
  steps: undefined,
  sampler: undefined,
  scheduler: undefined,
  seed: undefined,
  positivePrompt: undefined,
  negativePrompt: undefined,
  width: undefined,
  height: undefined,
  timestamp: 0,
  workflowFingerprint: '',
  workflowFilename: null,
  saveNodeIdentity: null
}

describe('moshpitFoldersStore', () => {
  beforeEach(async () => {
    // IDB reset must happen with real timers
    const { deleteMoshpitDB } = await import('../services/thumbRepository')
    await deleteMoshpitDB()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('create returns a uuid and adds an entry to folders Map', () => {
    const store = useMoshpitFoldersStore()
    const id = store.create('Shortlist A')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(store.folders.has(id)).toBe(true)
    expect(store.folders.get(id)?.name).toBe('Shortlist A')
  })

  it('orderedFolders returns folders sorted by createdAt ascending', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    const store = useMoshpitFoldersStore()
    const id1 = store.create('First')
    vi.setSystemTime(2000)
    const id2 = store.create('Second')
    const ordered = store.orderedFolders
    expect(ordered[0].id).toBe(id1)
    expect(ordered[1].id).toBe(id2)
  })

  it('rename updates the folder name', () => {
    const store = useMoshpitFoldersStore()
    const id = store.create('Old Name')
    store.rename(id, 'New Name')
    expect(store.folders.get(id)?.name).toBe('New Name')
  })

  it('remove deletes the folder from the Map', () => {
    const store = useMoshpitFoldersStore()
    const id = store.create('To Remove')
    store.remove(id)
    expect(store.folders.has(id)).toBe(false)
  })

  it('remove scrubs folder id from every CurationRecord.folders[] (Pitfall 4)', async () => {
    const { putAssetMeta, defaultCuration } =
      await import('../services/thumbRepository')
    await putAssetMeta({
      contentHash: 'h1',
      metadata: {},
      curation: defaultCuration(),
      params: stubParams
    })
    await putAssetMeta({
      contentHash: 'h2',
      metadata: {},
      curation: defaultCuration(),
      params: stubParams
    })

    const foldersStore = useMoshpitFoldersStore()
    const curationStore = useMoshpitCurationStore()

    const folderId = foldersStore.create('Scrub Me')
    curationStore.addToFolder('h1', folderId)
    curationStore.addToFolder('h2', folderId)

    expect(curationStore.get('h1')?.folders).toContain(folderId)
    expect(curationStore.get('h2')?.folders).toContain(folderId)

    foldersStore.remove(folderId)

    expect(curationStore.get('h1')?.folders).not.toContain(folderId)
    expect(curationStore.get('h2')?.folders).not.toContain(folderId)
    expect(foldersStore.folders.has(folderId)).toBe(false)
  })

  it('createFromSelection creates a folder and adds all hashes via addToFolder', () => {
    const foldersStore = useMoshpitFoldersStore()
    const curationStore = useMoshpitCurationStore()

    const id = foldersStore.createFromSelection('Winners', ['h1', 'h2', 'h3'])
    expect(foldersStore.folders.has(id)).toBe(true)
    expect(curationStore.get('h1')?.folders).toContain(id)
    expect(curationStore.get('h2')?.folders).toContain(id)
    expect(curationStore.get('h3')?.folders).toContain(id)
  })

  it('hydrate loads folders from foldersRepository.loadAllFolders', async () => {
    vi.mock('../services/foldersRepository', () => ({
      loadAllFolders: vi
        .fn()
        .mockResolvedValue([
          { id: 'f1', name: 'Hydrated', createdAt: 1700000000000 }
        ]),
      saveFolder: vi.fn().mockResolvedValue(undefined),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
      clearAllFolders: vi.fn().mockResolvedValue(undefined)
    }))
    const { useMoshpitFoldersStore: useStore } =
      await import('./moshpitFoldersStore')
    const store = useStore()
    await store.hydrate()
    expect(store.folders.has('f1')).toBe(true)
    expect(store.folders.get('f1')?.name).toBe('Hydrated')
  })

  it('create enforces folder count cap of 200', () => {
    const store = useMoshpitFoldersStore()
    for (let i = 0; i < 200; i++) {
      store.create(`folder-${i}`)
    }
    expect(store.folders.size).toBe(200)
    const extraId = store.create('one-too-many')
    expect(extraId).toBe('')
    expect(store.folders.size).toBe(200)
  })

  it('rename uses Map swap so Pinia watchers re-fire', () => {
    const store = useMoshpitFoldersStore()
    const id = store.create('Original')
    const before = store.folders
    store.rename(id, 'Updated')
    expect(store.folders).not.toBe(before)
  })
})
