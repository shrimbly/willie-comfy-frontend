<template>
  <div class="flex h-full flex-col">
    <!-- Assets Grid -->
    <VirtualGrid
      class="flex-1"
      :items="gridItems"
      :grid-style="gridStyle"
      :default-item-width="GRID_COLUMN_SIZES[gridSize]"
      :default-item-height="GRID_COLUMN_SIZES[gridSize] + 40"
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
          @click="emit('select-asset', item.asset)"
          @context-menu="emit('context-menu', $event, item.asset)"
          @zoom="emit('zoom', item.asset)"
          @output-count-click="emit('output-count-click', item.asset)"
        />
      </template>
    </VirtualGrid>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import VirtualGrid from '@/components/common/VirtualGrid.vue'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { FolderItem } from '@/utils/directoryPickerUtil'

const GRID_COLUMN_SIZES = { sm: 120, md: 180, lg: 260 } as const

const {
  assets,
  folders,
  isSelected,
  showOutputCount,
  getOutputCount,
  gridSize = 'md'
} = defineProps<{
  assets: AssetItem[]
  folders?: FolderItem[]
  isSelected: (assetId: string) => boolean
  showOutputCount: (asset: AssetItem) => boolean
  getOutputCount: (asset: AssetItem) => number
  gridSize?: 'sm' | 'md' | 'lg'
}>()

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem): void
  (e: 'context-menu', event: MouseEvent, asset: AssetItem): void
  (e: 'approach-end'): void
  (e: 'zoom', asset: AssetItem): void
  (e: 'output-count-click', asset: AssetItem): void
  (e: 'folder-click', folder: FolderItem): void
}>()

const { t } = useI18n()

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

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, ${GRID_COLUMN_SIZES[gridSize]}px)`,
  padding: '0 0.5rem',
  gap: '0.5rem'
}))
</script>
