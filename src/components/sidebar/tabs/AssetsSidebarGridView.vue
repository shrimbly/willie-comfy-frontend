<template>
  <div ref="wrapperRef" class="flex h-full flex-col">
    <!-- Assets Grid -->
    <VirtualGrid
      ref="virtualGridRef"
      class="flex-1"
      :items="gridItems"
      :grid-style="gridStyle"
      :max-columns="columns"
      :default-item-width="estimatedCellWidth"
      :default-item-height="estimatedCellWidth + 40"
      :buffer-rows="3"
      @approach-end="emit('approach-end')"
    >
      <template v-if="visibleFolders?.length" #header>
        <div class="flex flex-col gap-2 px-2 pb-2">
          <AssetsListItem
            v-for="folder in visibleFolders"
            :key="`folder-${folder.path}`"
            role="button"
            tabindex="0"
            :aria-label="folder.name"
            class="w-full cursor-pointer rounded-lg bg-secondary-background text-text-primary transition-colors hover:bg-secondary-background-hover"
            icon-name="pi pi-folder"
            :primary-text="folder.name"
            :secondary-text="
              folder.itemCount !== undefined
                ? `${folder.itemCount} ${folder.itemCount === 1 ? 'item' : 'items'}`
                : ''
            "
            @click.stop="emit('folder-click', folder)"
            @contextmenu.prevent.stop="
              emit('folder-context-menu', $event, folder)
            "
          />
          <div
            v-if="!foldersExpanded && hiddenFolderCount > 0"
            class="flex cursor-pointer items-center gap-2 px-2 py-1"
            @click="foldersExpanded = true"
          >
            <div class="h-px flex-1 bg-(--p-content-border-color)" />
            <span class="px-2 text-xs whitespace-nowrap text-muted-foreground">
              {{ t('assets.folders.showMore', { count: hiddenFolderCount }) }}
            </span>
            <div class="h-px flex-1 bg-(--p-content-border-color)" />
          </div>
        </div>
      </template>
      <template #item="{ item }">
        <MediaAssetCard
          :asset="item.asset"
          :selected="isSelected(item.asset.id)"
          :show-output-count="showOutputCount(item.asset)"
          :output-count="getOutputCount(item.asset)"
          :restrict-stack-favorites="restrictStackFavorites"
          @click="emit('select-asset', item.asset)"
          @context-menu="emit('context-menu', $event, item.asset)"
          @zoom="emit('zoom', item.asset)"
          @output-count-click="emit('output-count-click', item.asset)"
        />
      </template>
    </VirtualGrid>
    <div
      v-if="isDragging"
      class="pointer-events-none fixed z-50 rounded-sm border border-modal-card-border-highlighted bg-modal-card-border-highlighted/20"
      :style="marqueeStyle"
    />
  </div>
</template>

<script lang="ts">
export const GRID_COLUMN_RANGES = {
  sm: { min: 72, max: 104 },
  md: { min: 144, max: 220 },
  lg: { min: 224, max: 320 }
} as const

export const GAP_PX = 8
const PAD_PX = 8
const SCROLLBAR_PX = 15

export function computeColumns(
  width: number,
  min: number,
  max: number,
  gap: number
): number {
  if (width <= 0) return 1
  let cols = Math.max(1, Math.floor((width + gap) / (min + gap)))
  const cellWidth = (width - gap * (cols - 1)) / cols
  if (cellWidth > max) {
    cols = Math.ceil((width + gap) / (max + gap))
  }
  return cols
}
</script>

<script setup lang="ts">
import { useEventListener, useElementSize } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { ComponentExposed } from 'vue-component-type-helpers'
import type { CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'

import VirtualGrid from '@/components/common/VirtualGrid.vue'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import { useMarqueeSelection } from '@/platform/assets/composables/useMarqueeSelection'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { FolderItem } from '@/utils/directoryPickerUtil'

const {
  assets,
  folders,
  isSelected,
  showOutputCount,
  getOutputCount,
  gridSize = 'md',
  restrictStackFavorites = false
} = defineProps<{
  assets: AssetItem[]
  folders?: FolderItem[]
  isSelected: (assetId: string) => boolean
  showOutputCount: (asset: AssetItem) => boolean
  getOutputCount: (asset: AssetItem) => number
  gridSize?: 'sm' | 'md' | 'lg'
  restrictStackFavorites?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem): void
  (e: 'context-menu', event: MouseEvent, asset: AssetItem): void
  (e: 'approach-end'): void
  (e: 'zoom', asset: AssetItem): void
  (e: 'output-count-click', asset: AssetItem): void
  (e: 'folder-click', folder: FolderItem): void
  (e: 'folder-context-menu', event: MouseEvent, folder: FolderItem): void
}>()

const { t } = useI18n()

const wrapperRef = ref<HTMLElement | null>(null)
const virtualGridRef = ref<ComponentExposed<typeof VirtualGrid> | null>(null)
const { width: wrapperWidth } = useElementSize(wrapperRef)

const effectiveWidth = computed(() =>
  Math.max(0, wrapperWidth.value - PAD_PX * 2 - SCROLLBAR_PX)
)
const range = computed(() => GRID_COLUMN_RANGES[gridSize])
const columns = computed(() =>
  computeColumns(effectiveWidth.value, range.value.min, range.value.max, GAP_PX)
)
const estimatedCellWidth = computed(() => {
  if (columns.value < 1 || effectiveWidth.value <= 0) return range.value.min
  const raw =
    (effectiveWidth.value - GAP_PX * (columns.value - 1)) / columns.value
  return Math.min(range.value.max, Math.max(range.value.min, raw))
})

const MAX_VISIBLE_FOLDERS = 4
const foldersExpanded = ref(false)

const visibleFolders = computed(() => {
  if (!folders) return undefined
  if (folders.length <= MAX_VISIBLE_FOLDERS || foldersExpanded.value)
    return folders
  return folders.slice(0, MAX_VISIBLE_FOLDERS)
})

const hiddenFolderCount = computed(() => {
  if (!folders) return 0
  return Math.max(0, folders.length - MAX_VISIBLE_FOLDERS)
})

watch(
  () => folders,
  () => {
    foldersExpanded.value = false
  }
)

type GridItem = { key: string; type: 'asset'; asset: AssetItem }

const gridItems = computed<GridItem[]>(() => {
  return assets.map((asset) => ({
    key: `asset-${asset.id}`,
    type: 'asset' as const,
    asset
  }))
})

const gridStyle = computed<CSSProperties>(() => ({
  display: 'grid',
  padding: '0 0.5rem',
  gap: '0.5rem'
}))

const containerEl = computed(() => virtualGridRef.value?.container ?? null)
const marqueeItemWidth = computed(
  () => virtualGridRef.value?.itemWidth ?? estimatedCellWidth.value
)
const marqueeItemHeight = computed(
  () => virtualGridRef.value?.itemHeight ?? estimatedCellWidth.value + 40
)
const marqueeCols = computed(() => virtualGridRef.value?.cols ?? columns.value)
const marqueeStartIndex = computed(() => virtualGridRef.value?.startIndex ?? 0)

const { isDragging, marqueeStyle, onPointerDown } = useMarqueeSelection({
  containerEl,
  allAssets: computed(() => assets),
  cols: marqueeCols,
  itemWidth: marqueeItemWidth,
  itemHeight: marqueeItemHeight,
  startIndex: marqueeStartIndex,
  gap: GAP_PX,
  padLeft: PAD_PX
})

useEventListener(containerEl, 'pointerdown', onPointerDown)
</script>
