<template>
  <div class="flex h-full flex-col">
    <VirtualGrid
      class="flex-1"
      :items="listItems"
      :grid-style="listGridStyle"
      :max-columns="1"
      :default-item-height="48"
      @approach-end="emit('approach-end')"
    >
      <template #item="{ item }">
        <AssetsListItem
          v-if="item.type === 'folder'"
          role="button"
          tabindex="0"
          :aria-label="item.folder.name"
          class="w-full cursor-pointer rounded-lg bg-secondary-background text-text-primary transition-colors hover:bg-secondary-background-hover"
          icon-name="pi pi-folder"
          :primary-text="item.folder.name"
          :secondary-text="
            item.folder.itemCount !== undefined
              ? `${item.folder.itemCount} ${item.folder.itemCount === 1 ? 'item' : 'items'}`
              : ''
          "
          @click.stop="emit('folder-click', item.folder)"
          @contextmenu.prevent.stop="
            emit('folder-context-menu', $event, item.folder)
          "
        />
        <div
          v-else-if="item.type === 'show-more'"
          class="flex cursor-pointer items-center gap-2 px-2 py-1"
          @click="foldersExpanded = true"
        >
          <div class="h-px flex-1 bg-(--p-content-border-color)" />
          <span class="px-2 text-xs whitespace-nowrap text-muted-foreground">
            {{ t('assets.folders.showMore', { count: hiddenFolderCount }) }}
          </span>
          <div class="h-px flex-1 bg-(--p-content-border-color)" />
        </div>
        <div v-else class="relative">
          <LoadingOverlay
            :loading="assetsStore.isAssetDeleting(item.item.asset.id)"
            size="sm"
          >
            <i class="pi pi-trash text-xs" />
          </LoadingOverlay>
          <AssetsListItem
            role="button"
            tabindex="0"
            :aria-label="
              t('assetBrowser.ariaLabel.assetCard', {
                name: getAssetDisplayName(item.item.asset),
                type: getAssetMediaType(item.item.asset)
              })
            "
            :class="
              cn(
                getAssetCardClass(isSelected(item.item.asset.id)),
                item.item.isChild && 'pl-6'
              )
            "
            :preview-url="getAssetPreviewUrl(item.item.asset)"
            :preview-alt="getAssetDisplayName(item.item.asset)"
            :icon-name="iconForMediaType(getAssetMediaType(item.item.asset))"
            :is-video-preview="isVideoAsset(item.item.asset)"
            :primary-text="getAssetPrimaryText(item.item.asset)"
            :secondary-text="getAssetSecondaryText(item.item.asset)"
            :stack-count="getStackCount(item.item.asset)"
            :stack-indicator-label="t('mediaAsset.actions.seeMoreOutputs')"
            :stack-expanded="isStackExpanded(item.item.asset)"
            @mouseenter="onAssetEnter(item.item.asset.id)"
            @mouseleave="onAssetLeave(item.item.asset.id)"
            @contextmenu.prevent.stop="
              emit('context-menu', $event, item.item.asset)
            "
            @click.stop="
              emit('select-asset', item.item.asset, selectableAssets)
            "
            @dblclick.stop="emit('preview-asset', item.item.asset)"
            @preview-click="emit('preview-asset', item.item.asset)"
            @stack-toggle="void toggleStack(item.item.asset)"
          >
            <template
              v-if="
                hoveredAssetId === item.item.asset.id ||
                showFavoriteIcon(item.item)
              "
              #actions
            >
              <FavoriteColorPicker
                v-if="showFavoriteButton(item.item)"
                :asset="item.item.asset"
                orientation="horizontal"
              />
              <Button
                v-if="hoveredAssetId === item.item.asset.id"
                variant="secondary"
                size="icon"
                :aria-label="t('mediaAsset.actions.moreOptions')"
                @click.stop="emit('context-menu', $event, item.item.asset)"
              >
                <i class="icon-[lucide--ellipsis] size-4" />
              </Button>
            </template>
          </AssetsListItem>
        </div>
      </template>
    </VirtualGrid>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import Button from '@/components/ui/button/Button.vue'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'
import FavoriteColorPicker from '@/platform/assets/components/FavoriteColorPicker.vue'
import { useAssetFavorites } from '@/platform/assets/composables/useAssetFavorites'
import type { OutputStackListItem } from '@/platform/assets/composables/useOutputStacks'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetDisplayName } from '@/platform/assets/utils/assetMetadataUtils'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { useAssetsStore } from '@/stores/assetsStore'
import type { FolderItem } from '@/utils/directoryPickerUtil'
import {
  formatDuration,
  formatSize,
  getMediaTypeFromFilename,
  truncateFilename
} from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

const {
  assetItems,
  folders,
  selectableAssets,
  isSelected,
  isStackExpanded,
  toggleStack,
  restrictStackFavorites = false
} = defineProps<{
  assetItems: OutputStackListItem[]
  folders?: FolderItem[]
  selectableAssets: AssetItem[]
  isSelected: (assetId: string) => boolean
  isStackExpanded: (asset: AssetItem) => boolean
  toggleStack: (asset: AssetItem) => Promise<void>
  restrictStackFavorites?: boolean
}>()

const assetsStore = useAssetsStore()

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem, assets?: AssetItem[]): void
  (e: 'preview-asset', asset: AssetItem): void
  (e: 'context-menu', event: MouseEvent, asset: AssetItem): void
  (e: 'approach-end'): void
  (e: 'folder-click', folder: FolderItem): void
  (e: 'folder-context-menu', event: MouseEvent, folder: FolderItem): void
}>()

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

type ListItem =
  | { key: string; type: 'folder'; folder: FolderItem }
  | { key: string; type: 'show-more' }
  | { key: string; type: 'asset'; item: OutputStackListItem }

const listItems = computed<ListItem[]>(() => {
  const items: ListItem[] = []
  if (visibleFolders.value) {
    visibleFolders.value.forEach((folder) => {
      items.push({ key: `folder-${folder.path}`, type: 'folder', folder })
    })
    if (!foldersExpanded.value && hiddenFolderCount.value > 0) {
      items.push({ key: 'show-more-folders', type: 'show-more' })
    }
  }
  assetItems.forEach((item) => {
    items.push({ key: `asset-${item.asset.id}`, type: 'asset', item })
  })
  return items
})

const { t } = useI18n()
const hoveredAssetId = ref<string | null>(null)

const listGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  padding: '0 0.5rem',
  gap: '0.5rem'
}

function getAssetPrimaryText(asset: AssetItem): string {
  return truncateFilename(getAssetDisplayName(asset))
}

function getAssetMediaType(asset: AssetItem) {
  return getMediaTypeFromFilename(asset.name)
}

function isVideoAsset(asset: AssetItem): boolean {
  return getAssetMediaType(asset) === 'video'
}

function getAssetPreviewUrl(asset: AssetItem): string {
  const mediaType = getAssetMediaType(asset)
  if (mediaType === 'image' || mediaType === 'video') {
    return asset.preview_url || ''
  }
  return ''
}

function getAssetSecondaryText(asset: AssetItem): string {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (typeof metadata?.executionTimeInSeconds === 'number') {
    return `${metadata.executionTimeInSeconds.toFixed(2)}s`
  }

  const duration = asset.user_metadata?.duration
  if (typeof duration === 'number') {
    return formatDuration(duration)
  }

  if (typeof asset.size === 'number') {
    return formatSize(asset.size)
  }

  return ''
}

function getStackCount(asset: AssetItem): number | undefined {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (typeof metadata?.outputCount === 'number') {
    return metadata.outputCount
  }

  if (Array.isArray(metadata?.allOutputs)) {
    return metadata.allOutputs.length
  }

  return undefined
}

function getAssetCardClass(selected: boolean): string {
  return cn(
    'w-full text-text-primary transition-colors hover:bg-secondary-background-hover',
    'cursor-pointer',
    selected &&
      'bg-secondary-background-hover ring-1 ring-modal-card-border-highlighted ring-inset'
  )
}

function onAssetEnter(assetId: string) {
  hoveredAssetId.value = assetId
}

function onAssetLeave(assetId: string) {
  if (hoveredAssetId.value === assetId) {
    hoveredAssetId.value = null
  }
}

const favorites = useAssetFavorites()

function isStackParent(item: OutputStackListItem): boolean {
  if (item.isChild) return false
  const count = getStackCount(item.asset)
  return typeof count === 'number' && count > 1
}

function showFavoriteButton(item: OutputStackListItem): boolean {
  if (!restrictStackFavorites) return true
  return !isStackParent(item)
}

function showFavoriteIcon(item: OutputStackListItem): boolean {
  return showFavoriteButton(item) && favorites.isFavorited(item.asset)
}
</script>
