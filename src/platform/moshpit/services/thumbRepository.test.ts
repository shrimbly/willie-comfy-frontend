import { beforeEach, describe, expect, it } from 'vitest'

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

  it('putAssetMeta + getAssetMeta round-trips parsed metadata and default curation', async () => {
    const { putAssetMeta, getAssetMeta, defaultCuration } =
      await import('./thumbRepository')
    await putAssetMeta({
      contentHash: 'abc',
      metadata: { workflow: '{}' },
      curation: defaultCuration()
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
})
