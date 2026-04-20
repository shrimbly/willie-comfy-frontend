import { openDB } from 'idb'
import { beforeEach, describe, expect, it } from 'vitest'

import type { NormalizedParams } from './paramNormalize'
import { MOSHPIT_DB_NAME } from './thumbRepository.types'

// A minimal NormalizedParams fixture for v2 round-trip tests
const sampleParams: NormalizedParams = {
  model: 'v1-5-pruned.safetensors',
  loras: [{ name: 'detail_lora', weight: 0.8 }],
  cfg: 7.0,
  steps: 20,
  sampler: 'euler',
  scheduler: 'normal',
  seed: 42,
  positivePrompt: 'a photo of a cat',
  negativePrompt: 'blurry',
  width: 512,
  height: 512,
  timestamp: 1700000000000,
  workflowFingerprint: 'CheckpointLoaderSimple|KSampler',
  workflowFilename: 'my_sweep'
}

describe('thumbRepository (Wave 1, fake-indexeddb)', () => {
  beforeEach(async () => {
    // Reset the fake DB between tests
    const { deleteMoshpitDB } = await import('./thumbRepository')
    await deleteMoshpitDB()
  })

  it('putThumb then getThumb round-trips a blob by contentHash', async () => {
    const { putThumb, getThumb } = await import('./thumbRepository')
    const blob = new Blob(['thumb-bytes'], { type: 'image/webp' })
    await putThumb({
      contentHash: 'abc',
      blob,
      width: 512,
      height: 512,
      generatedAt: 1
    })
    const got = await getThumb('abc')
    expect(got?.contentHash).toBe('abc')
    expect(got?.width).toBe(512)
    expect(got?.height).toBe(512)
  })

  it('getAllThumbHashes returns the set of cached hashes', async () => {
    const { putThumb, getAllThumbHashes } = await import('./thumbRepository')
    const blob = new Blob(['x'], { type: 'image/webp' })
    await putThumb({
      contentHash: 'a',
      blob,
      width: 512,
      height: 512,
      generatedAt: 1
    })
    await putThumb({
      contentHash: 'b',
      blob,
      width: 512,
      height: 512,
      generatedAt: 1
    })
    const hashes = await getAllThumbHashes()
    expect(new Set(hashes)).toEqual(new Set(['a', 'b']))
  })

  it('putAssetMeta + getAssetMeta round-trips parsed metadata and default curation at v2 schema', async () => {
    const { putAssetMeta, getAssetMeta, defaultCuration } =
      await import('./thumbRepository')
    await putAssetMeta({
      contentHash: 'abc',
      metadata: { workflow: '{}' },
      curation: defaultCuration(),
      params: sampleParams
    })
    const got = await getAssetMeta('abc')
    expect(got?.curation).toEqual({
      favourite: false,
      tags: [],
      folders: [],
      hidden: false
    })
    expect(got?.metadata.workflow).toBe('{}')
  })

  it('putAssetMeta round-trips params field intact at schema v2', async () => {
    const { putAssetMeta, getAssetMeta, defaultCuration } =
      await import('./thumbRepository')
    await putAssetMeta({
      contentHash: 'hash-params-rt',
      metadata: { prompt: '{}' },
      curation: defaultCuration(),
      params: sampleParams
    })
    const got = await getAssetMeta('hash-params-rt')
    expect(got?.params).toEqual(sampleParams)
    expect(got?.params.model).toBe('v1-5-pruned.safetensors')
    expect(got?.params.cfg).toBe(7.0)
    expect(got?.params.loras).toHaveLength(1)
    expect(got?.params.loras[0]).toEqual({ name: 'detail_lora', weight: 0.8 })
    expect(got?.params.workflowFingerprint).toBe(
      'CheckpointLoaderSimple|KSampler'
    )
    expect(got?.params.workflowFilename).toBe('my_sweep')
    expect(got?.params.timestamp).toBe(1700000000000)
  })

  it('getAssetMeta on a missing hash returns undefined', async () => {
    const { getAssetMeta } = await import('./thumbRepository')
    const got = await getAssetMeta('nonexistent-hash')
    expect(got).toBeUndefined()
  })

  it('putAssetMeta + getAssetMeta round-trips params with all undefined optional fields', async () => {
    const { putAssetMeta, getAssetMeta, defaultCuration } =
      await import('./thumbRepository')
    const emptyParams: NormalizedParams = {
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
      timestamp: 1700000000001,
      workflowFingerprint: '',
      workflowFilename: null
    }
    await putAssetMeta({
      contentHash: 'hash-empty-params',
      metadata: {},
      curation: defaultCuration(),
      params: emptyParams
    })
    const got = await getAssetMeta('hash-empty-params')
    expect(got?.params).toEqual(emptyParams)
    expect(got?.params.model).toBeUndefined()
    expect(got?.params.loras).toHaveLength(0)
    expect(got?.params.workflowFilename).toBeNull()
  })
})

describe('thumbRepository v1→v2 migration', () => {
  beforeEach(async () => {
    const { deleteMoshpitDB } = await import('./thumbRepository')
    await deleteMoshpitDB()
  })

  it('upgrade from v1 populates params on existing assetMeta records', async () => {
    // Seed a v1-shaped record (without params) directly via raw idb
    const promptJson = JSON.stringify({
      '1': {
        class_type: 'KSampler',
        inputs: {
          cfg: 8.0,
          steps: 25,
          sampler_name: 'dpmpp_2m',
          scheduler: 'karras',
          seed: 99
        }
      },
      '2': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'dreamshaper.safetensors' }
      }
    })
    const v1db = await openDB(MOSHPIT_DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('thumbs')) {
          db.createObjectStore('thumbs', { keyPath: 'contentHash' })
        }
        if (!db.objectStoreNames.contains('assetMeta')) {
          db.createObjectStore('assetMeta', { keyPath: 'contentHash' })
        }
      }
    })
    // Put a v1 record shaped WITHOUT params
    await v1db.put('assetMeta', {
      contentHash: 'v1-record',
      metadata: { prompt: promptJson },
      curation: { favourite: false, tags: [], folders: [], hidden: false }
    })
    v1db.close()

    // Now open via openMoshpitDB() which triggers v1→v2 upgrade
    const { openMoshpitDB } = await import('./thumbRepository')
    await openMoshpitDB()

    const { getAssetMeta } = await import('./thumbRepository')
    const got = await getAssetMeta('v1-record')
    expect(got).toBeDefined()
    expect(got?.params).toBeDefined()
    expect(typeof got?.params.timestamp).toBe('number')
    // Params should have been re-parsed from metadata
    expect(got?.params.cfg).toBe(8.0)
    expect(got?.params.steps).toBe(25)
    expect(got?.params.sampler).toBe('dpmpp_2m')
    expect(got?.params.model).toBe('dreamshaper.safetensors')
  })

  it('migration is idempotent — opening twice does not re-migrate or throw', async () => {
    const { openMoshpitDB } = await import('./thumbRepository')
    // First open at v2 (fresh)
    await openMoshpitDB()
    const { deleteMoshpitDB } = await import('./thumbRepository')
    // Second open — should be a no-op (already at v2, cachedDB returned)
    const db = await openMoshpitDB()
    expect(db).toBeDefined()
    await deleteMoshpitDB()
  })

  it('migration handles empty assetMeta store without errors', async () => {
    // Open fresh DB at v1 (no records)
    const v1db = await openDB(MOSHPIT_DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('thumbs')) {
          db.createObjectStore('thumbs', { keyPath: 'contentHash' })
        }
        if (!db.objectStoreNames.contains('assetMeta')) {
          db.createObjectStore('assetMeta', { keyPath: 'contentHash' })
        }
      }
    })
    v1db.close()

    // Open via openMoshpitDB() — empty store, no cursor iterations, no errors
    const { openMoshpitDB } = await import('./thumbRepository')
    const db = await openMoshpitDB()
    expect(db).toBeDefined()
    // No records to check — just verifying it doesn't throw
  })

  it('migration skips records that already have params (defensive guard)', async () => {
    // Put a record with params already populated at v1 (simulating a previously-migrated record)
    // Open at v2 schema directly (pretend v1 had params — edge case guard)
    const { openMoshpitDB, putAssetMeta, getAssetMeta, defaultCuration } =
      await import('./thumbRepository')
    await openMoshpitDB()

    const existingParams: NormalizedParams = {
      model: 'already-migrated.safetensors',
      loras: [],
      cfg: 6.0,
      steps: 10,
      sampler: 'euler',
      scheduler: 'normal',
      seed: 1,
      positivePrompt: undefined,
      negativePrompt: undefined,
      width: 512,
      height: 512,
      timestamp: 1700000001000,
      workflowFingerprint: 'CheckpointLoaderSimple',
      workflowFilename: null
    }
    await putAssetMeta({
      contentHash: 'already-has-params',
      metadata: { prompt: '{}' },
      curation: defaultCuration(),
      params: existingParams
    })

    // Re-open (cached — not re-migrated)
    const db2 = await openMoshpitDB()
    expect(db2).toBeDefined()

    // Record should still have the original params (not overwritten)
    const got = await getAssetMeta('already-has-params')
    expect(got?.params.model).toBe('already-migrated.safetensors')
    expect(got?.params.cfg).toBe(6.0)
  })
})
