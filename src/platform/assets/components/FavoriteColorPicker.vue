<template>
  <div
    ref="rootRef"
    :class="
      cn(
        'flex shrink-0 items-center justify-center rounded-lg border-none transition-[background-color,filter,padding,gap,opacity,transform] duration-150 ease-out',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
        anyOtherVisible
          ? orientation === 'horizontal'
            ? 'gap-1'
            : 'gap-0.5'
          : 'gap-0',
        pill
          ? 'bg-white p-1 drop-shadow-(--interface-panel-drop-shadow)'
          : 'bg-transparent p-0 drop-shadow-none',
        visible
          ? 'scale-100 opacity-100'
          : 'pointer-events-none scale-95 opacity-0'
      )
    "
  >
    <button
      v-for="color in COLUMN_ORDER"
      :key="color"
      type="button"
      :class="
        cn(
          'flex cursor-pointer items-center justify-center overflow-hidden rounded-md border-none bg-transparent transition-all duration-200 ease-out hover:scale-110',
          pill && 'hover:bg-black/10',
          isVisible(color)
            ? 'max-h-7 max-w-7 scale-100 p-0.5 opacity-100'
            : orientation === 'horizontal'
              ? 'pointer-events-none max-h-7 max-w-0 scale-90 px-0 py-0.5 opacity-0'
              : 'pointer-events-none max-h-0 max-w-7 scale-90 px-0.5 py-0 opacity-0',
          colorClass(color)
        )
      "
      :aria-label="$t(`mediaAsset.actions.favoriteColor.${color}`)"
      :aria-pressed="activeColor === color"
      :tabindex="isVisible(color) ? 0 : -1"
      :aria-hidden="!isVisible(color) || undefined"
      @click.stop="handleSelectColor(color)"
    >
      <i
        :class="
          cn(
            'transition-[width,height,filter] duration-200 ease-out',
            pill
              ? 'size-4 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]'
              : 'size-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]',
            activeColor === color ? 'icon-[ph--star-fill]' : 'icon-[ph--star]'
          )
        "
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { computed, ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { useAssetFavorites } from '../composables/useAssetFavorites'
import type { FavoriteColor } from '../composables/useAssetFavorites'
import type { AssetItem } from '../schemas/assetSchema'

const {
  asset,
  expanded = false,
  pill = true,
  visible = true,
  orientation = 'vertical'
} = defineProps<{
  asset: AssetItem
  expanded?: boolean
  pill?: boolean
  visible?: boolean
  orientation?: 'vertical' | 'horizontal'
}>()

const favorites = useAssetFavorites()

const COLUMN_ORDER: FavoriteColor[] = ['yellow', 'blue', 'green']

const rootRef = ref<HTMLElement | null>(null)
const isOwnHovered = useElementHover(rootRef)

const activeColor = computed(() => favorites.getFavoriteColor(asset))

const defaultVisibleColor = computed<FavoriteColor>(
  () => activeColor.value ?? 'yellow'
)

function isVisible(color: FavoriteColor): boolean {
  return expanded || isOwnHovered.value || color === defaultVisibleColor.value
}

const anyOtherVisible = computed(() => expanded || isOwnHovered.value)

function colorClass(color: FavoriteColor): string {
  switch (color) {
    case 'yellow':
      return 'text-citrine-400'
    case 'blue':
      return 'text-azure-400'
    case 'green':
      return 'text-jade-600'
  }
}

async function handleSelectColor(color: FavoriteColor) {
  const next = activeColor.value === color ? null : color
  await favorites.setFavoriteColor(asset, next)
}
</script>
