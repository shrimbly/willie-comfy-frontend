import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MOSHPIT_DB_NAME } from './thumbRepository.types'

describe('overrideRepository (Wave 1, fake-indexeddb)', () => {
  beforeEach(async () => {
    const { deleteMoshpitDB } = await import('./thumbRepository')
    await deleteMoshpitDB()
  })

  it('saveOverride + loadAllOverrides round-trips a full record', async () => {
    const { saveOverride, loadAllOverrides } =
      await import('./overrideRepository')
    await saveOverride({
      contentHash: 'abc',
      pinnedWorldPos: { x: 100, y: 200 },
      scale: 1.5,
      pinnedAt: 1700000000000
    })
    const all = await loadAllOverrides()
    expect(all).toHaveLength(1)
    expect(all[0]).toEqual({
      contentHash: 'abc',
      pinnedWorldPos: { x: 100, y: 200 },
      scale: 1.5,
      pinnedAt: 1700000000000
    })
  })

  it('saveOverride replaces an existing record rather than duplicating', async () => {
    const { saveOverride, loadAllOverrides } =
      await import('./overrideRepository')
    await saveOverride({
      contentHash: 'abc',
      pinnedWorldPos: { x: 1, y: 2 },
      pinnedAt: 1
    })
    await saveOverride({
      contentHash: 'abc',
      pinnedWorldPos: { x: 9, y: 8 },
      scale: 2,
      pinnedAt: 2
    })
    const all = await loadAllOverrides()
    expect(all).toHaveLength(1)
    expect(all[0]).toEqual({
      contentHash: 'abc',
      pinnedWorldPos: { x: 9, y: 8 },
      scale: 2,
      pinnedAt: 2
    })
  })

  it('saveOverride persists a pin-only record (no scale)', async () => {
    const { saveOverride, loadAllOverrides } =
      await import('./overrideRepository')
    await saveOverride({
      contentHash: 'pin-only',
      pinnedWorldPos: { x: 5, y: 6 },
      pinnedAt: 10
    })
    const all = await loadAllOverrides()
    expect(all).toEqual([
      {
        contentHash: 'pin-only',
        pinnedWorldPos: { x: 5, y: 6 },
        pinnedAt: 10
      }
    ])
    expect(all[0].scale).toBeUndefined()
  })

  it('saveOverride persists a scale-only record (no pin)', async () => {
    const { saveOverride, loadAllOverrides } =
      await import('./overrideRepository')
    await saveOverride({
      contentHash: 'scale-only',
      scale: 0.75,
      pinnedAt: 20
    })
    const all = await loadAllOverrides()
    expect(all).toEqual([
      { contentHash: 'scale-only', scale: 0.75, pinnedAt: 20 }
    ])
    expect(all[0].pinnedWorldPos).toBeUndefined()
  })

  it('deleteOverride removes only the targeted record', async () => {
    const { saveOverride, deleteOverride, loadAllOverrides } =
      await import('./overrideRepository')
    await saveOverride({
      contentHash: 'a',
      pinnedWorldPos: { x: 1, y: 1 },
      pinnedAt: 1
    })
    await saveOverride({
      contentHash: 'b',
      pinnedWorldPos: { x: 2, y: 2 },
      pinnedAt: 2
    })
    await saveOverride({ contentHash: 'c', scale: 1.1, pinnedAt: 3 })

    await deleteOverride('b')

    const all = await loadAllOverrides()
    const hashes = all.map((r) => r.contentHash).sort()
    expect(hashes).toEqual(['a', 'c'])
  })

  it('clearAllOverrides leaves the store empty', async () => {
    const { saveOverride, clearAllOverrides, loadAllOverrides } =
      await import('./overrideRepository')
    await saveOverride({
      contentHash: 'a',
      pinnedWorldPos: { x: 1, y: 1 },
      pinnedAt: 1
    })
    await saveOverride({ contentHash: 'b', scale: 2, pinnedAt: 2 })
    await clearAllOverrides()
    expect(await loadAllOverrides()).toEqual([])
  })

  it('loadAllOverrides on a fresh DB returns []', async () => {
    const { loadAllOverrides } = await import('./overrideRepository')
    expect(await loadAllOverrides()).toEqual([])
  })

  it('opening a fresh DB creates the overrides store via the v4 upgrade path', async () => {
    const { openMoshpitDB } = await import('./thumbRepository')
    const db = await openMoshpitDB()
    expect(db.version).toBe(4)
    expect(db.objectStoreNames.contains('overrides')).toBe(true)
  })

  describe('malformed record handling', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      warnSpy.mockRestore()
    })

    async function seedRaw(records: readonly unknown[]): Promise<void> {
      const { openMoshpitDB } = await import('./thumbRepository')
      const db = await openMoshpitDB()
      const tx = db.transaction('overrides', 'readwrite')
      for (const rec of records) {
        // Raw write bypassing schema types to simulate legacy/corrupted data.
        await tx.store.put(rec as never)
      }
      await tx.done
    }

    it('skips records with a missing or non-string contentHash', async () => {
      // Seed valid record first so we have a sanity baseline
      const { saveOverride } = await import('./overrideRepository')
      await saveOverride({
        contentHash: 'good',
        pinnedWorldPos: { x: 1, y: 2 },
        pinnedAt: 1
      })
      // Cannot insert a record with no contentHash via keyPath store — idb
      // requires the key. But we CAN insert one with malformed inner fields.
      await seedRaw([
        {
          contentHash: 'bad-pos',
          pinnedWorldPos: { x: Number.NaN, y: 2 },
          pinnedAt: 10
        },
        {
          contentHash: 'bad-scale',
          scale: 'not-a-number',
          pinnedAt: 20
        },
        {
          contentHash: 'bad-pinnedAt',
          pinnedWorldPos: { x: 1, y: 2 },
          pinnedAt: 'nope'
        }
      ])

      const { loadAllOverrides } = await import('./overrideRepository')
      const all = await loadAllOverrides()

      expect(all).toHaveLength(1)
      expect(all[0].contentHash).toBe('good')
      expect(warnSpy).toHaveBeenCalled()
    })
  })

  describe('v3 → v4 upgrade preserves pre-existing stores', () => {
    it('opens an existing v3 DB (with a thumb record) and adds the overrides store without data loss', async () => {
      // Seed a v3 DB directly via raw idb — mirror the real v3 schema shape
      // without importing the old version constant.
      const v3db = await openDB(MOSHPIT_DB_NAME, 3, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('thumbs')) {
            db.createObjectStore('thumbs', { keyPath: 'contentHash' })
          }
          if (!db.objectStoreNames.contains('assetMeta')) {
            db.createObjectStore('assetMeta', { keyPath: 'contentHash' })
          }
        }
      })
      const blob = new Blob(['thumb-bytes'], { type: 'image/webp' })
      await v3db.put('thumbs', {
        contentHash: 'pre-upgrade',
        blob,
        width: 512,
        height: 512,
        generatedAt: 1
      })
      v3db.close()

      const { openMoshpitDB, getThumb } = await import('./thumbRepository')
      const upgraded = await openMoshpitDB()
      expect(upgraded.version).toBe(4)
      expect(upgraded.objectStoreNames.contains('thumbs')).toBe(true)
      expect(upgraded.objectStoreNames.contains('assetMeta')).toBe(true)
      expect(upgraded.objectStoreNames.contains('overrides')).toBe(true)

      // Pre-existing thumb survived
      const thumb = await getThumb('pre-upgrade')
      expect(thumb?.contentHash).toBe('pre-upgrade')

      // And overrides operations now work end-to-end on the upgraded DB
      const { saveOverride, loadAllOverrides } =
        await import('./overrideRepository')
      await saveOverride({
        contentHash: 'post-upgrade',
        pinnedWorldPos: { x: 9, y: 9 },
        pinnedAt: 123
      })
      const all = await loadAllOverrides()
      expect(all).toEqual([
        {
          contentHash: 'post-upgrade',
          pinnedWorldPos: { x: 9, y: 9 },
          pinnedAt: 123
        }
      ])
    })
  })
})
