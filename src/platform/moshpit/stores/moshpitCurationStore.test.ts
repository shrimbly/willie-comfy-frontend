import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { NormalizedParams } from '../services/paramNormalize'
import { useMoshpitCurationStore } from './moshpitCurationStore'

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

describe('moshpitCurationStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('load stores a CurationRecord by contentHash', () => {
    const store = useMoshpitCurationStore()
    store.load({
      contentHash: 'h1',
      metadata: {},
      curation: { favourite: true, tags: ['a'], folders: [], hidden: false },
      params: stubParams
    })
    expect(store.get('h1')?.favourite).toBe(true)
    expect(store.get('h1')?.tags).toEqual(['a'])
  })

  it('get returns undefined for unknown hash', () => {
    const store = useMoshpitCurationStore()
    expect(store.get('missing')).toBeUndefined()
  })

  it('reset clears the map', () => {
    const store = useMoshpitCurationStore()
    store.load({
      contentHash: 'h1',
      metadata: {},
      curation: { favourite: false, tags: [], folders: [], hidden: false },
      params: stubParams
    })
    store.reset()
    expect(store.get('h1')).toBeUndefined()
  })
})

describe('moshpitCurationStore — mutations', () => {
  beforeEach(async () => {
    // Reset IDB before fake timers (async IDB ops need real timers)
    const { deleteMoshpitDB } = await import('../services/thumbRepository')
    await deleteMoshpitDB()
    const { putAssetMeta, defaultCuration } =
      await import('../services/thumbRepository')
    await putAssetMeta({
      contentHash: 'h1',
      metadata: {},
      curation: defaultCuration(),
      params: stubParams
    })
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('setFavourite creates a CurationRecord with favourite:true for a new hash', () => {
    const store = useMoshpitCurationStore()
    store.setFavourite('h1', true)
    expect(store.get('h1')?.favourite).toBe(true)
    expect(store.get('h1')?.tags).toEqual([])
    expect(store.get('h1')?.folders).toEqual([])
    expect(store.get('h1')?.hidden).toBe(false)
  })

  it('setFavourite is idempotent — calling twice does not change curationByHash reference', () => {
    const store = useMoshpitCurationStore()
    store.setFavourite('h1', true)
    const ref1 = store.get('h1')
    store.setFavourite('h1', true)
    const ref2 = store.get('h1')
    expect(ref1).toBe(ref2)
  })

  it('addTag deduplicates — adding the same tag twice results in one entry', () => {
    const store = useMoshpitCurationStore()
    store.addTag('h1', 'hero')
    store.addTag('h1', 'hero')
    expect(store.get('h1')?.tags).toEqual(['hero'])
  })

  it('addTag trims whitespace and rejects empty post-trim tags', () => {
    const store = useMoshpitCurationStore()
    store.addTag('h1', '  hero  ')
    expect(store.get('h1')?.tags).toEqual(['hero'])
    store.addTag('h1', '   ')
    expect(store.get('h1')?.tags).toEqual(['hero'])
  })

  it('addTag enforces tag length cap of 64 chars', () => {
    const store = useMoshpitCurationStore()
    // Seed a valid short tag first to ensure the record exists
    store.addTag('h1', 'seed')
    const longTag = 'a'.repeat(65)
    store.addTag('h1', longTag)
    // Only the valid seed tag, not the overlong one
    expect(store.get('h1')?.tags).toEqual(['seed'])
  })

  it('addTag enforces tag count cap of 50 per asset', () => {
    const store = useMoshpitCurationStore()
    for (let i = 0; i < 50; i++) {
      store.addTag('h1', `tag-${i}`)
    }
    expect(store.get('h1')?.tags).toHaveLength(50)
    store.addTag('h1', 'one-too-many')
    expect(store.get('h1')?.tags).toHaveLength(50)
  })

  it('removeTag on a non-existent hash is a no-op (no throw, no record created)', () => {
    const store = useMoshpitCurationStore()
    expect(() => store.removeTag('nope', 'hero')).not.toThrow()
    expect(store.get('nope')).toBeUndefined()
  })

  it('removeTag removes the tag from an existing hash', () => {
    const store = useMoshpitCurationStore()
    store.addTag('h1', 'hero')
    store.addTag('h1', 'winner')
    store.removeTag('h1', 'hero')
    expect(store.get('h1')?.tags).toEqual(['winner'])
  })

  it('setHidden updates hidden:true', () => {
    const store = useMoshpitCurationStore()
    store.setHidden('h1', true)
    expect(store.get('h1')?.hidden).toBe(true)
  })

  it('addToFolder appends folderId; removeFromFolder removes it', () => {
    const store = useMoshpitCurationStore()
    store.addToFolder('h1', 'folder-uuid')
    expect(store.get('h1')?.folders).toEqual(['folder-uuid'])
    store.removeFromFolder('h1', 'folder-uuid')
    expect(store.get('h1')?.folders).toEqual([])
  })

  it('addToFolder deduplicates folder ids', () => {
    const store = useMoshpitCurationStore()
    store.addToFolder('h1', 'folder-uuid')
    store.addToFolder('h1', 'folder-uuid')
    expect(store.get('h1')?.folders).toEqual(['folder-uuid'])
  })

  it('mutations use new Map assignment so curationByHash ref updates', () => {
    const store = useMoshpitCurationStore()
    const before = store.curationByHash
    store.setFavourite('h1', true)
    expect(store.curationByHash).not.toBe(before)
  })

  it('debounced persist calls saveCuration after 100ms', async () => {
    vi.mock('../services/curationRepository', () => ({
      saveCuration: vi.fn().mockResolvedValue(undefined),
      saveManyCurations: vi.fn().mockResolvedValue(undefined),
      loadAllCurations: vi.fn().mockResolvedValue(new Map())
    }))
    vi.useFakeTimers()
    const { saveCuration } = await import('../services/curationRepository')
    const store = useMoshpitCurationStore()
    store.setFavourite('h1', true)
    await vi.runAllTimersAsync()
    expect(vi.mocked(saveCuration)).toHaveBeenCalledWith(
      'h1',
      expect.objectContaining({ favourite: true })
    )
  })

  it('applyManyOptimistic replaces all entries in one Map swap and calls saveManyCurations', async () => {
    vi.mock('../services/curationRepository', () => ({
      saveCuration: vi.fn().mockResolvedValue(undefined),
      saveManyCurations: vi.fn().mockResolvedValue(undefined),
      loadAllCurations: vi.fn().mockResolvedValue(new Map())
    }))
    const { saveManyCurations } = await import('../services/curationRepository')
    const store = useMoshpitCurationStore()
    const updates = new Map([
      ['h1', { favourite: true, tags: [], folders: [], hidden: false }],
      ['h2', { favourite: false, tags: ['ok'], folders: [], hidden: true }]
    ])
    await store.applyManyOptimistic(updates)
    expect(store.get('h1')?.favourite).toBe(true)
    expect(store.get('h2')?.tags).toEqual(['ok'])
    expect(vi.mocked(saveManyCurations)).toHaveBeenCalledWith(updates)
  })
})
