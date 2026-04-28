import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const updateAssetTags = vi.fn(async () => {})

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    updateAssetTags
  })
}))

import {
  FAVORITE_COLORS,
  favoriteTagFor,
  useAssetFavorites
} from './useAssetFavorites'

function makeAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: overrides.id ?? 'asset-1',
    name: overrides.name ?? 'image.png',
    tags: overrides.tags ?? [],
    user_metadata: overrides.user_metadata ?? {},
    ...overrides
  } as AssetItem
}

describe('useAssetFavorites', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    updateAssetTags.mockClear()
  })

  it('exposes the three colors and tag helper', () => {
    expect(FAVORITE_COLORS).toEqual(['yellow', 'blue', 'green'])
    expect(favoriteTagFor('blue')).toBe('favorite-blue')
  })

  it('reads favorite color from existing tags', () => {
    const { getFavoriteColor, isFavorited } = useAssetFavorites()
    const asset = makeAsset({ id: 'a', tags: ['output', 'favorite-green'] })

    expect(getFavoriteColor(asset)).toBe('green')
    expect(isFavorited(asset)).toBe(true)
  })

  it('returns null when no favorite tag is present', () => {
    const { getFavoriteColor, isFavorited } = useAssetFavorites()
    const asset = makeAsset({ id: 'b', tags: ['output'] })

    expect(getFavoriteColor(asset)).toBeNull()
    expect(isFavorited(asset)).toBe(false)
  })

  it('sets a color by appending the matching favorite tag', async () => {
    const { setFavoriteColor, getFavoriteColor } = useAssetFavorites()
    const asset = makeAsset({ id: 'c', tags: ['output'] })

    await setFavoriteColor(asset, 'yellow')

    expect(getFavoriteColor(asset)).toBe('yellow')
    expect(updateAssetTags).toHaveBeenCalledWith(asset, [
      'output',
      'favorite-yellow'
    ])
    expect(asset.tags).toEqual(['output', 'favorite-yellow'])
  })

  it('replaces an existing color tag when switching colors', async () => {
    const { setFavoriteColor, getFavoriteColor } = useAssetFavorites()
    const asset = makeAsset({ id: 'd', tags: ['output', 'favorite-yellow'] })

    await setFavoriteColor(asset, 'blue')

    expect(getFavoriteColor(asset)).toBe('blue')
    expect(asset.tags).toEqual(['output', 'favorite-blue'])
  })

  it('removes the color tag when set to null', async () => {
    const { setFavoriteColor, getFavoriteColor, isFavorited } =
      useAssetFavorites()
    const asset = makeAsset({ id: 'e', tags: ['output', 'favorite-green'] })

    await setFavoriteColor(asset, null)

    expect(getFavoriteColor(asset)).toBeNull()
    expect(isFavorited(asset)).toBe(false)
    expect(asset.tags).toEqual(['output'])
  })

  it('toggleFavorite defaults to yellow and unfavorites on second call', async () => {
    const { toggleFavorite, getFavoriteColor } = useAssetFavorites()
    const asset = makeAsset({ id: 'f', tags: ['output'] })

    await toggleFavorite(asset)
    expect(getFavoriteColor(asset)).toBe('yellow')

    await toggleFavorite(asset)
    expect(getFavoriteColor(asset)).toBeNull()
  })

  it('reverts optimistic state when the server call fails', async () => {
    updateAssetTags.mockRejectedValueOnce(new Error('boom'))

    const { setFavoriteColor, getFavoriteColor } = useAssetFavorites()
    const asset = makeAsset({ id: 'g', tags: ['output'] })

    await expect(setFavoriteColor(asset, 'yellow')).rejects.toThrow('boom')
    expect(getFavoriteColor(asset)).toBeNull()
    expect(asset.tags).toEqual(['output'])
  })
})
