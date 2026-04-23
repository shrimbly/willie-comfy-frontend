import 'fake-indexeddb/auto'

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { NormalizedParams } from '../services/paramNormalize'
import { putAssetMeta, defaultCuration, deleteMoshpitDB } from '../services/thumbRepository'
import { useMoshpitCurationStore } from '../stores/moshpitCurationStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { UNDO_WINDOW_MS, useMoshpitCuration } from './useMoshpitCuration'

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

async function seedRecord(hash: string): Promise<void> {
  await putAssetMeta({
    contentHash: hash,
    metadata: {},
    curation: defaultCuration(),
    params: stubParams
  })
}

describe('useMoshpitCuration — favouriteMany', () => {
  beforeEach(async () => {
    await deleteMoshpitDB()
    await seedRecord('h1')
    await seedRecord('h2')
    await seedRecord('h3')
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('bulk favourite applies curation and fires a toast with group moshpit-curation', async () => {
    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')
    const curation = useMoshpitCuration()

    curation.favouriteMany(['h1', 'h2', 'h3'], true)

    const curationStore = useMoshpitCurationStore()
    expect(curationStore.get('h1')?.favourite).toBe(true)
    expect(curationStore.get('h2')?.favourite).toBe(true)

    expect(addSpy).toHaveBeenCalledOnce()
    const msg = addSpy.mock.calls[0][0]
    expect(msg.group).toBe('moshpit-curation')
    expect(msg.life).toBe(UNDO_WINDOW_MS)
  })

  it('single-asset favourite does NOT fire a toast', () => {
    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')
    const curation = useMoshpitCuration()

    curation.favouriteMany(['h1'], true)

    expect(addSpy).not.toHaveBeenCalled()
  })

  it('favouriteMany with no-op (already at target) does nothing', () => {
    const curationStore = useMoshpitCurationStore()
    curationStore.setFavourite('h1', true)
    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')
    const curation = useMoshpitCuration()

    // h1 is already favourite, h2 and h3 are not — next.size should be 2 (not 0)
    // to test the true no-op case, set all three
    curationStore.setFavourite('h2', true)
    curationStore.setFavourite('h3', true)
    curation.favouriteMany(['h1', 'h2', 'h3'], true)

    expect(addSpy).not.toHaveBeenCalled()
  })

  it('favouriteMany empty array is a no-op', () => {
    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')
    const curation = useMoshpitCuration()

    curation.favouriteMany([], true)

    expect(addSpy).not.toHaveBeenCalled()
  })
})

describe('useMoshpitCuration — undoLast', () => {
  beforeEach(async () => {
    await deleteMoshpitDB()
    await seedRecord('h1')
    await seedRecord('h2')
    await seedRecord('h3')
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('undoLast within window restores prior state and returns true', async () => {
    const curation = useMoshpitCuration()
    const curationStore = useMoshpitCurationStore()

    curation.favouriteMany(['h1', 'h2'], true)
    expect(curationStore.get('h1')?.favourite).toBe(true)

    const ok = curation.undoLast()
    expect(ok).toBe(true)
    // lastUndoable should be cleared
    expect(curation.lastUndoable.value).toBeNull()
  })

  it('undoLast past the 8s window returns false and does not apply inverse', async () => {
    const curation = useMoshpitCuration()
    const curationStore = useMoshpitCurationStore()

    curation.favouriteMany(['h1', 'h2'], true)
    expect(curationStore.get('h1')?.favourite).toBe(true)

    // advance past the undo window
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 100)

    const ok = curation.undoLast()
    expect(ok).toBe(false)
    // still favourite (inverse not applied)
    expect(curationStore.get('h1')?.favourite).toBe(true)
    // lastUndoable cleared after expiry check
    expect(curation.lastUndoable.value).toBeNull()
  })

  it('undoLast when nothing to undo returns false', () => {
    const curation = useMoshpitCuration()
    const ok = curation.undoLast()
    expect(ok).toBe(false)
  })

  it('two bulk actions — lastUndoable overwrites, undoLast only reverses the second', async () => {
    const curation = useMoshpitCuration()
    const curationStore = useMoshpitCurationStore()

    curation.favouriteMany(['h1', 'h2'], true)
    curation.hideMany(['h3'], true)

    const ok = curation.undoLast()
    expect(ok).toBe(true)
    // h3 hidden should be reversed
    expect(curationStore.get('h3')?.hidden).toBe(false)
    // h1/h2 favourite stays (first action not undone)
    expect(curationStore.get('h1')?.favourite).toBe(true)
  })
})

describe('useMoshpitCuration — tagMany', () => {
  beforeEach(async () => {
    await deleteMoshpitDB()
    await seedRecord('h1')
    await seedRecord('h2')
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('tagMany adds tag idempotently and captures inverse', () => {
    const curation = useMoshpitCuration()
    const curationStore = useMoshpitCurationStore()

    // seed h1 with existing tag 'a', h2 with ['hero', 'b']
    curationStore.addTag('h1', 'a')
    curationStore.addTag('h2', 'hero')
    curationStore.addTag('h2', 'b')

    curation.tagMany(['h1', 'h2'], 'hero')

    // h1 gets ['a', 'hero'], h2 stays ['hero', 'b'] (already has it)
    expect(curationStore.get('h1')?.tags).toEqual(['a', 'hero'])
    expect(curationStore.get('h2')?.tags).toEqual(['hero', 'b'])

    // undo restores prior
    curation.undoLast()
    expect(curationStore.get('h1')?.tags).toEqual(['a'])
    expect(curationStore.get('h2')?.tags).toEqual(['hero', 'b'])
  })

  it('tagMany with empty tag fires warn toast and does not mutate', () => {
    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')
    const curation = useMoshpitCuration()
    const curationStore = useMoshpitCurationStore()

    curation.tagMany(['h1'], '   ')

    expect(addSpy).toHaveBeenCalledOnce()
    expect(addSpy.mock.calls[0][0].severity).toBe('warn')
    expect(curationStore.get('h1')?.tags).toEqual([])
  })

  it('tagMany with tag longer than 64 chars fires warn toast and does not mutate', () => {
    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')
    const curation = useMoshpitCuration()
    const curationStore = useMoshpitCurationStore()

    curation.tagMany(['h1'], 'a'.repeat(65))

    expect(addSpy).toHaveBeenCalledOnce()
    expect(addSpy.mock.calls[0][0].severity).toBe('warn')
    expect(curationStore.get('h1')?.tags).toEqual([])
  })
})

describe('useMoshpitCuration — hideMany / unhideMany', () => {
  beforeEach(async () => {
    await deleteMoshpitDB()
    await seedRecord('h1')
    await seedRecord('h2')
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('hideMany flips hidden to true and captures inverse for undo', () => {
    const curation = useMoshpitCuration()
    const curationStore = useMoshpitCurationStore()

    curation.hideMany(['h1', 'h2'], true)
    expect(curationStore.get('h1')?.hidden).toBe(true)
    expect(curationStore.get('h2')?.hidden).toBe(true)

    curation.undoLast()
    expect(curationStore.get('h1')?.hidden).toBe(false)
    expect(curationStore.get('h2')?.hidden).toBe(false)
  })

  it('unhideMany flips hidden to false', () => {
    const curationStore = useMoshpitCurationStore()
    curationStore.setHidden('h1', true)
    curationStore.setHidden('h2', true)

    const curation = useMoshpitCuration()
    curation.hideMany(['h1', 'h2'], false)
    expect(curationStore.get('h1')?.hidden).toBe(false)
  })
})

describe('useMoshpitCuration — exportMany', () => {
  beforeEach(async () => {
    await deleteMoshpitDB()
    await seedRecord('h1')
    await seedRecord('h2')
    await seedRecord('h3')
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('exportMany calls download for each resolvable hash and fires one info toast', () => {
    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')

    const resolveFullResUrl = vi.fn((hash: string) =>
      hash === 'h3' ? null : `http://example.com/${hash}.png`
    )

    const curation = useMoshpitCuration({ resolveFullResUrl })

    // Mock document.createElement to intercept download
    const clickSpy = vi.fn()
    const removeSpy = vi.fn()
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = { href: '', download: '', click: clickSpy, remove: removeSpy } as unknown as HTMLAnchorElement
        return a
      }
      return document.createElement(tag)
    })

    curation.exportMany(['h1', 'h2', 'h3'])

    // h3 is null so 2 downloads
    expect(clickSpy).toHaveBeenCalledTimes(2)
    // one info toast
    expect(addSpy).toHaveBeenCalledOnce()
    expect(addSpy.mock.calls[0][0].severity).toBe('info')
    // export is NOT undoable
    expect(curation.lastUndoable.value).toBeNull()

    appendSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('exportMany skips hashes with null resolver result', () => {
    const resolveFullResUrl = vi.fn(() => null)
    const curation = useMoshpitCuration({ resolveFullResUrl })

    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')

    curation.exportMany(['h1', 'h2'])

    expect(addSpy).not.toHaveBeenCalled()
    expect(curation.lastUndoable.value).toBeNull()
  })

  it('exportMany without resolveFullResUrl option is a no-op', () => {
    const curation = useMoshpitCuration()
    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')

    curation.exportMany(['h1'])

    expect(addSpy).not.toHaveBeenCalled()
  })
})

describe('useMoshpitCuration — addToFolderMany / removeFromFolderMany', () => {
  beforeEach(async () => {
    await deleteMoshpitDB()
    await seedRecord('h1')
    await seedRecord('h2')
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('addToFolderMany adds folder id and is undoable', () => {
    const curation = useMoshpitCuration()
    const curationStore = useMoshpitCurationStore()

    curation.addToFolderMany(['h1', 'h2'], 'folder-1')
    expect(curationStore.get('h1')?.folders).toContain('folder-1')
    expect(curationStore.get('h2')?.folders).toContain('folder-1')

    curation.undoLast()
    expect(curationStore.get('h1')?.folders).not.toContain('folder-1')
    expect(curationStore.get('h2')?.folders).not.toContain('folder-1')
  })

  it('removeFromFolderMany removes folder id and is undoable', () => {
    const curationStore = useMoshpitCurationStore()
    curationStore.addToFolder('h1', 'folder-1')
    curationStore.addToFolder('h2', 'folder-1')

    const curation = useMoshpitCuration()

    curation.removeFromFolderMany(['h1', 'h2'], 'folder-1')
    expect(curationStore.get('h1')?.folders).not.toContain('folder-1')

    curation.undoLast()
    expect(curationStore.get('h1')?.folders).toContain('folder-1')
    expect(curationStore.get('h2')?.folders).toContain('folder-1')
  })
})
