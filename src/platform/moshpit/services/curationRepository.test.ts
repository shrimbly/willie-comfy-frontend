import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'

import type { NormalizedParams } from './paramNormalize'

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
  timestamp: 1700000000000,
  workflowFingerprint: '',
  workflowFilename: null,
  saveNodeIdentity: null
}

describe('curationRepository (fake-indexeddb)', () => {
  beforeEach(async () => {
    const { deleteMoshpitDB } = await import('./thumbRepository')
    await deleteMoshpitDB()
  })

  async function seedAssetMeta(hash: string): Promise<void> {
    const { putAssetMeta, defaultCuration } = await import('./thumbRepository')
    await putAssetMeta({
      contentHash: hash,
      metadata: {},
      curation: defaultCuration(),
      params: stubParams
    })
  }

  it('saveCuration round-trips a CurationRecord via assetMeta store', async () => {
    await seedAssetMeta('hash-1')
    const { saveCuration } = await import('./curationRepository')
    const { getAssetMeta } = await import('./thumbRepository')
    const next = { favourite: true, tags: ['hero'], folders: [], hidden: false }
    await saveCuration('hash-1', next)
    const got = await getAssetMeta('hash-1')
    expect(got?.curation).toEqual(next)
  })

  it('saveCuration on a missing hash is a silent no-op (no throw, no insert)', async () => {
    const { saveCuration } = await import('./curationRepository')
    const { getAssetMeta } = await import('./thumbRepository')
    await expect(
      saveCuration('nonexistent', {
        favourite: true,
        tags: [],
        folders: [],
        hidden: false
      })
    ).resolves.toBeUndefined()
    expect(await getAssetMeta('nonexistent')).toBeUndefined()
  })

  it('saveCuration preserves other assetMeta fields (params, metadata)', async () => {
    await seedAssetMeta('hash-preserve')
    const { saveCuration } = await import('./curationRepository')
    const { getAssetMeta } = await import('./thumbRepository')
    await saveCuration('hash-preserve', {
      favourite: false,
      tags: ['kept'],
      folders: [],
      hidden: true
    })
    const got = await getAssetMeta('hash-preserve')
    expect(got?.contentHash).toBe('hash-preserve')
    expect(got?.params).toBeDefined()
    expect(got?.curation.tags).toEqual(['kept'])
    expect(got?.curation.hidden).toBe(true)
  })

  it('saveManyCurations writes all records in a single transaction', async () => {
    await seedAssetMeta('h1')
    await seedAssetMeta('h2')
    await seedAssetMeta('h3')
    const { saveManyCurations } = await import('./curationRepository')
    const { getAssetMeta } = await import('./thumbRepository')
    const updates = new Map([
      ['h1', { favourite: true, tags: [], folders: [], hidden: false }],
      ['h2', { favourite: false, tags: ['tag2'], folders: [], hidden: false }],
      [
        'h3',
        { favourite: false, tags: [], folders: ['folder-x'], hidden: true }
      ]
    ])
    await saveManyCurations(updates)
    const r1 = await getAssetMeta('h1')
    const r2 = await getAssetMeta('h2')
    const r3 = await getAssetMeta('h3')
    expect(r1?.curation.favourite).toBe(true)
    expect(r2?.curation.tags).toEqual(['tag2'])
    expect(r3?.curation.hidden).toBe(true)
  })

  it('saveManyCurations silently skips hashes without assetMeta', async () => {
    await seedAssetMeta('present-1')
    await seedAssetMeta('present-2')
    const { saveManyCurations } = await import('./curationRepository')
    const { getAssetMeta } = await import('./thumbRepository')
    const updates = new Map([
      ['present-1', { favourite: true, tags: [], folders: [], hidden: false }],
      ['missing', { favourite: true, tags: [], folders: [], hidden: false }],
      ['present-2', { favourite: false, tags: ['ok'], folders: [], hidden: false }]
    ])
    await expect(saveManyCurations(updates)).resolves.toBeUndefined()
    const r1 = await getAssetMeta('present-1')
    expect(r1?.curation.favourite).toBe(true)
    expect(await getAssetMeta('missing')).toBeUndefined()
  })

  it('loadAllCurations returns a Map of hash to CurationRecord', async () => {
    await seedAssetMeta('la-1')
    await seedAssetMeta('la-2')
    const { saveCuration, loadAllCurations } = await import(
      './curationRepository'
    )
    await saveCuration('la-1', {
      favourite: true,
      tags: [],
      folders: [],
      hidden: false
    })
    const map = await loadAllCurations()
    expect(map.size).toBeGreaterThanOrEqual(2)
    expect(map.get('la-1')?.favourite).toBe(true)
    expect(map.has('la-2')).toBe(true)
  })
})
