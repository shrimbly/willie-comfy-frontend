import { ref } from 'vue'

import { useAssetsStore } from '@/stores/assetsStore'

import type { AssetItem } from '../schemas/assetSchema'

export const FAVORITE_COLORS = ['yellow', 'blue', 'green'] as const
export type FavoriteColor = (typeof FAVORITE_COLORS)[number]

const FAVORITE_TAG_PREFIX = 'favorite-'

export function favoriteTagFor(color: FavoriteColor): string {
  return `${FAVORITE_TAG_PREFIX}${color}`
}

function tagToColor(tag: string): FavoriteColor | null {
  if (!tag.startsWith(FAVORITE_TAG_PREFIX)) return null
  const candidate = tag.slice(FAVORITE_TAG_PREFIX.length)
  return (FAVORITE_COLORS as readonly string[]).includes(candidate)
    ? (candidate as FavoriteColor)
    : null
}

function readColorFromTags(
  tags: readonly string[] | undefined
): FavoriteColor | null {
  if (!tags) return null
  for (const tag of tags) {
    const color = tagToColor(tag)
    if (color) return color
  }
  return null
}

const optimisticColorById = ref(new Map<string, FavoriteColor | null>())

function rememberColor(assetId: string, color: FavoriteColor | null) {
  const next = new Map(optimisticColorById.value)
  next.set(assetId, color)
  optimisticColorById.value = next
}

function forgetOptimistic(assetId: string) {
  if (!optimisticColorById.value.has(assetId)) return
  const next = new Map(optimisticColorById.value)
  next.delete(assetId)
  optimisticColorById.value = next
}

export function useAssetFavorites() {
  const assetsStore = useAssetsStore()

  function getFavoriteColor(asset: AssetItem): FavoriteColor | null {
    if (optimisticColorById.value.has(asset.id)) {
      return optimisticColorById.value.get(asset.id) ?? null
    }
    return readColorFromTags(asset.tags)
  }

  function isFavorited(asset: AssetItem): boolean {
    return getFavoriteColor(asset) !== null
  }

  async function setFavoriteColor(
    asset: AssetItem,
    color: FavoriteColor | null
  ): Promise<void> {
    const currentColor = getFavoriteColor(asset)
    if (currentColor === color) return

    const originalTags = asset.tags ?? []
    const tagsWithoutFavorite = originalTags.filter(
      (tag) => tagToColor(tag) === null
    )
    const newTags = color
      ? [...tagsWithoutFavorite, favoriteTagFor(color)]
      : tagsWithoutFavorite

    rememberColor(asset.id, color)
    asset.tags = newTags

    try {
      await assetsStore.updateAssetTags(asset, newTags)
    } catch (error) {
      asset.tags = originalTags
      if (currentColor === readColorFromTags(originalTags)) {
        forgetOptimistic(asset.id)
      } else {
        rememberColor(asset.id, currentColor)
      }
      throw error
    }
  }

  async function toggleFavorite(asset: AssetItem): Promise<void> {
    const current = getFavoriteColor(asset)
    await setFavoriteColor(asset, current ? null : 'yellow')
  }

  function favoritedAssets(assets: readonly AssetItem[]): AssetItem[] {
    return assets.filter(isFavorited)
  }

  return {
    isFavorited,
    getFavoriteColor,
    setFavoriteColor,
    toggleFavorite,
    favoritedAssets
  }
}
