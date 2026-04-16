<template>
  <SidebarTabTemplate title="" v-bind="$attrs">
    <template #alt-title>
      <!-- Folder view: job ID display -->
      <div
        v-if="isInFolderView"
        class="flex w-full items-center justify-between gap-2"
      >
        <div class="flex items-center gap-2">
          <span class="font-bold">{{ $t('assetBrowser.jobId') }}:</span>
          <span class="text-sm">{{ folderJobId?.substring(0, 8) }}</span>
          <button
            class="m-0 cursor-pointer border-0 bg-transparent p-0 outline-0"
            role="button"
            @click="copyJobId"
          >
            <i class="icon-[lucide--copy] text-sm"></i>
          </button>
        </div>
        <div>
          <span>{{ formattedExecutionTime }}</span>
        </div>
      </div>
      <!-- Normal view: title only (source selection moved to filter panel) -->
      <div v-else class="flex w-full items-center justify-between gap-2">
        <span
          class="truncate font-bold"
          :title="$t('sideToolbar.mediaAssets.title')"
        >
          {{ $t('sideToolbar.mediaAssets.title') }}
        </span>
      </div>
    </template>
    <template #header>
      <!-- Job Detail View Header -->
      <div v-if="isInFolderView" class="px-2 2xl:px-4">
        <Button variant="secondary" size="lg" @click="exitFolderView">
          <i class="icon-[lucide--arrow-left] size-4" />
          <span>{{ $t('sideToolbar.backToAssets') }}</span>
        </Button>
      </div>

      <!-- Filter Bar -->
      <MediaAssetFilterBar
        v-model:search-query="searchQuery"
        v-model:sort-by="sortBy"
        v-model:view-mode="viewMode"
        v-model:media-type-filters="mediaTypeFilters"
        bottom-divider
        :show-generation-time-sort="activeSources.includes('output')"
      />
      <!-- Subfolder breadcrumb removed from header — now inside body -->
    </template>
    <template #body>
      <div class="assets-content-layout">
        <!-- Left Filter Panel -->
        <AssetFilterPanel
          v-if="!isInFolderView"
          v-model:date-range="dateRangeFilter"
          v-model:media-type-filters="mediaTypeFilters"
          v-model:active-sources="activeSources"
          v-model:show-subdirectories="showSubdirectories"
          :assets="baseAssets"
          :custom-directories="savedCustomDirectories"
          @clear-filters="clearAllFilters"
          @add-directory="handleAddDirectory"
          @remove-directory="handleRemoveDirectory"
        />

        <!-- Main Content Area -->
        <div class="assets-main-content">
          <!-- Breadcrumb navigation -->
          <div
            v-if="!isInFolderView && singleActiveSource"
            class="sticky top-0 z-10 flex items-center gap-0.5 border-b border-comfy-input bg-base-background px-2 py-1.5 text-xs"
          >
            <button
              :class="[
                'truncate rounded-sm border-none px-1 py-0.5 transition-colors',
                breadcrumbSegments.length > 0
                  ? 'cursor-pointer bg-transparent text-muted-foreground hover:bg-secondary-background-hover hover:text-text-primary'
                  : 'bg-transparent font-medium text-text-primary'
              ]"
              :disabled="breadcrumbSegments.length === 0"
              @click="handleBreadcrumbNavigate(-1)"
            >
              {{ breadcrumbRootLabel }}
            </button>
            <!-- Truncated breadcrumb: root > ... > last -->
            <template v-if="breadcrumbSegments.length > 1">
              <Popover :show-arrow="false">
                <template #button>
                  <button
                    class="cursor-pointer rounded-sm border-none bg-transparent px-1 py-0.5 text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-text-primary"
                  >
                    &hellip;
                  </button>
                </template>
                <template #default="{ close }">
                  <div class="flex flex-col">
                    <button
                      v-for="(segment, index) in breadcrumbSegments.slice(
                        0,
                        -1
                      )"
                      :key="index"
                      class="cursor-pointer rounded-sm border-none bg-transparent px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-text-primary"
                      @click="
                        handleBreadcrumbNavigate(index)
                        close()
                      "
                    >
                      {{ sentenceCase(segment) }}
                    </button>
                  </div>
                </template>
              </Popover>
              <button
                class="truncate rounded-sm border-none bg-transparent px-1 py-0.5 font-medium text-text-primary transition-colors"
                disabled
              >
                {{
                  sentenceCase(
                    breadcrumbSegments[breadcrumbSegments.length - 1]
                  )
                }}
              </button>
            </template>
            <!-- Single segment: root > segment -->
            <template v-else-if="breadcrumbSegments.length === 1">
              <button
                class="truncate rounded-sm border-none bg-transparent px-1 py-0.5 font-medium text-text-primary transition-colors"
                disabled
              >
                {{ sentenceCase(breadcrumbSegments[0]) }}
              </button>
            </template>
            <button
              class="ml-auto shrink-0 cursor-pointer rounded-sm border-none bg-transparent p-1 text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-text-primary"
              :aria-label="t('refresh')"
              @click="refreshAssets"
            >
              <i class="icon-[lucide--refresh-cw] size-3" />
            </button>
          </div>
          <div
            v-if="showLoadingState"
            class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2 p-2"
          >
            <div
              v-for="n in skeletonCount"
              :key="`skeleton-${n}`"
              class="flex flex-col gap-2 p-2"
            >
              <Skeleton class="aspect-square w-full rounded-lg" />
              <div class="flex flex-col gap-1">
                <Skeleton class="h-4 w-3/4" />
                <Skeleton class="h-3 w-1/2" />
              </div>
            </div>
          </div>
          <div v-else-if="showEmptyState">
            <NoResultsPlaceholder
              icon="pi pi-info-circle"
              :title="$t(emptyStateTitle)"
              :message="$t('sideToolbar.noFilesFoundMessage')"
            />
          </div>
          <div
            v-else
            class="relative size-full py-2"
            @click="handleEmptySpaceClick"
          >
            <AssetsSidebarListView
              v-if="isListView"
              :asset-items="listViewAssetItems"
              :folders="currentFolders"
              :is-selected="isSelected"
              :selectable-assets="listViewSelectableAssets"
              :is-stack-expanded="isListViewStackExpanded"
              :toggle-stack="toggleListViewStack"
              @select-asset="handleAssetSelect"
              @preview-asset="handleZoomClick"
              @context-menu="handleAssetContextMenu"
              @approach-end="handleApproachEnd"
              @folder-click="handleFolderClick"
            />
            <AssetsSidebarGridView
              v-else
              :assets="displayAssets"
              :folders="currentFolders"
              :is-selected="isSelected"
              :show-output-count="shouldShowOutputCount"
              :get-output-count="getOutputCount"
              :grid-size="gridSize"
              @select-asset="handleAssetSelect"
              @folder-click="handleFolderClick"
              @context-menu="handleAssetContextMenu"
              @approach-end="handleApproachEnd"
              @zoom="handleZoomClick"
              @output-count-click="enterFolderView"
            />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <!-- Selection Footer -->
      <div
        v-if="hasSelection"
        ref="footerRef"
        class="flex h-18 w-full items-center justify-between gap-1"
      >
        <div class="flex-1 pl-4">
          <div ref="selectionCountButtonRef" class="inline-flex w-48">
            <Button
              variant="secondary"
              :class="cn(isCompact && 'text-left')"
              @click="handleDeselectAll"
            >
              {{
                isHoveringSelectionCount
                  ? $t('mediaAsset.selection.deselectAll')
                  : $t('mediaAsset.selection.selectedCount', {
                      count: totalOutputCount
                    })
              }}
            </Button>
          </div>
        </div>
        <div class="flex shrink items-center-safe justify-end-safe gap-2 pr-4">
          <template v-if="isCompact">
            <!-- Compact mode: Icon only -->
            <Button
              v-if="shouldShowDeleteButton"
              size="icon"
              data-testid="assets-delete-selected"
              @click="handleDeleteSelected"
            >
              <i class="icon-[lucide--trash-2] size-4" />
            </Button>
            <Button
              size="icon"
              data-testid="assets-download-selected"
              @click="handleDownloadSelected"
            >
              <i class="icon-[lucide--download] size-4" />
            </Button>
          </template>
          <template v-else>
            <!-- Normal mode: Icon + Text -->
            <Button
              v-if="shouldShowDeleteButton"
              variant="secondary"
              data-testid="assets-delete-selected"
              @click="handleDeleteSelected"
            >
              <span>{{ $t('mediaAsset.selection.deleteSelected') }}</span>
              <i class="icon-[lucide--trash-2] size-4" />
            </Button>
            <Button
              variant="secondary"
              data-testid="assets-download-selected"
              @click="handleDownloadSelected"
            >
              <span>{{ $t('mediaAsset.selection.downloadSelected') }}</span>
              <i class="icon-[lucide--download] size-4" />
            </Button>
          </template>
        </div>
      </div>
    </template>
  </SidebarTabTemplate>
  <MediaLightbox
    v-model:active-index="galleryActiveIndex"
    :all-gallery-items="galleryItems"
  />
  <MediaAssetContextMenu
    v-if="contextMenuAsset"
    ref="contextMenuRef"
    :asset="contextMenuAsset"
    :asset-type="contextMenuAssetType"
    :file-kind="contextMenuFileKind"
    :show-delete-button="shouldShowDeleteButton"
    :selected-assets="selectedAssets"
    :is-bulk-mode="isBulkMode"
    @zoom="handleZoomClick(contextMenuAsset)"
    @hide="handleContextMenuHide"
    @asset-deleted="refreshAssets"
    @bulk-download="handleBulkDownload"
    @bulk-move="handleBulkMove"
    @bulk-delete="handleBulkDelete"
    @bulk-add-to-workflow="handleBulkAddToWorkflow"
    @bulk-open-workflow="handleBulkOpenWorkflow"
    @bulk-export-workflow="handleBulkExportWorkflow"
  />
</template>

<script setup lang="ts">
import {
  useAsyncState,
  useDebounceFn,
  useElementHover,
  useResizeObserver,
  useStorage,
  useTimeoutFn
} from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowReactive,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import AssetsSidebarGridView from '@/components/sidebar/tabs/AssetsSidebarGridView.vue'
import AssetsSidebarListView from '@/components/sidebar/tabs/AssetsSidebarListView.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/Popover.vue'
import AssetFilterPanel from '@/platform/assets/components/AssetFilterPanel.vue'
import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import MediaAssetFilterBar from '@/platform/assets/components/MediaAssetFilterBar.vue'
import type { ViewMode } from '@/platform/assets/components/MediaAssetFilterBar.vue'
import { getAssetType } from '@/platform/assets/composables/media/assetMappers'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { useCustomDirectoryAssets } from '@/platform/assets/composables/media/useCustomDirectoryAssets'
import { useAssetSelection } from '@/platform/assets/composables/useAssetSelection'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { useMediaAssetFiltering } from '@/platform/assets/composables/useMediaAssetFiltering'
import { useAssetFilters } from '@/platform/assets/composables/useAssetFilters'
import { useOutputStacks } from '@/platform/assets/composables/useOutputStacks'
import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetDisplayName } from '@/platform/assets/utils/assetMetadataUtils'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'
import type { FolderItem } from '@/utils/directoryPickerUtil'
import { isCloud } from '@/platform/distribution/types'
import { useDialogStore } from '@/stores/dialogStore'
import { ResultItemImpl } from '@/stores/queueStore'
import {
  formatDuration,
  getMediaTypeFromFilename,
  isPreviewableMediaType
} from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

const Load3dViewerContent = defineAsyncComponent(
  () => import('@/components/load3d/Load3dViewerContent.vue')
)

const { t } = useI18n()

const emit = defineEmits<{ assetSelected: [asset: AssetItem] }>()

// --- Source selection (replaces old tab system) ---
const activeSources = useStorage<string[]>('Comfy.Assets.ActiveSources', [
  'output'
])

interface SavedCustomDirectory {
  id: string
  name: string
}

const savedCustomDirectories = useStorage<SavedCustomDirectory[]>(
  'Comfy.Assets.CustomDirectories',
  []
)

// Runtime map of custom directory providers (not persisted — handles are session-only)
type CustomDirProvider = ReturnType<typeof useCustomDirectoryAssets>
const customDirProviders = shallowReactive(new Map<string, CustomDirProvider>())

// On setup, remove any custom dir IDs from activeSources since handles don't survive reload
activeSources.value = activeSources.value.filter(
  (s) => s === 'output' || s === 'input'
)

// Computed helper: which single source is active (null if 0 or 2+)
const singleActiveSource = computed(() => {
  if (activeSources.value.length === 1) return activeSources.value[0]
  return null
})

const showSubdirectories = ref(true)

const folderJobId = ref<string | null>(null)
const folderExecutionTime = ref<number | undefined>(undefined)
const expectedFolderCount = ref(0)
const isInFolderView = computed(() => folderJobId.value !== null)
const viewMode = useStorage<ViewMode>(
  'Comfy.Assets.Sidebar.ViewMode',
  'grid-md'
)
const isListView = computed(() => viewMode.value === 'list')
const gridSize = computed<'sm' | 'md' | 'lg'>(() => {
  if (viewMode.value === 'grid-sm') return 'sm'
  if (viewMode.value === 'grid-lg') return 'lg'
  return 'md'
})

const contextMenuRef = ref<InstanceType<typeof MediaAssetContextMenu>>()
const contextMenuAsset = ref<AssetItem | null>(null)

// Hide delete button when only input is active in non-cloud mode
const shouldShowDeleteButton = computed(() => {
  if (
    activeSources.value.length === 1 &&
    activeSources.value[0] === 'input' &&
    !isCloud
  )
    return false
  return true
})

const contextMenuAssetType = computed(() =>
  contextMenuAsset.value ? getAssetType(contextMenuAsset.value.tags) : 'input'
)

const contextMenuFileKind = computed<MediaKind>(() =>
  getMediaTypeFromFilename(contextMenuAsset.value?.name ?? '')
)

const shouldShowOutputCount = (item: AssetItem): boolean => {
  if (isInFolderView.value) return false
  // Only show output count badge for output assets
  if (!item.tags?.includes('output')) return false
  return getOutputCount(item) > 1
}

const formattedExecutionTime = computed(() => {
  if (!folderExecutionTime.value) return ''
  return formatDuration(folderExecutionTime.value * 1000)
})

const toast = useToast()

const inputAssets = useMediaAssets('input')
const outputAssets = useMediaAssets('output')

// Date range filtering
const dateRangeFilter = useStorage<[Date, Date] | null>(
  'Comfy.Assets.DateRange',
  null
)

// Asset selection
const {
  isSelected,
  handleAssetClick,
  hasSelection,
  clearSelection,
  getSelectedAssets,
  reconcileSelection,
  getOutputCount,
  getTotalOutputCount,
  activate: activateSelection,
  deactivate: deactivateSelection
} = useAssetSelection()

const {
  downloadMultipleAssets,
  deleteAssets,
  moveAssets,
  addMultipleToWorkflow,
  openMultipleWorkflows,
  exportMultipleWorkflows
} = useMediaAssetActions()

// Footer responsive behavior
const footerRef = ref<HTMLElement | null>(null)
const footerWidth = ref(0)

// Track footer width changes
useResizeObserver(footerRef, (entries) => {
  const entry = entries[0]
  footerWidth.value = entry.contentRect.width
})

// Determine if we should show compact mode (icon only)
const COMPACT_MODE_THRESHOLD_PX = 430
const isCompact = computed(
  () => footerWidth.value > 0 && footerWidth.value <= COMPACT_MODE_THRESHOLD_PX
)

// Hover state for selection count button
const selectionCountButtonRef = ref<HTMLElement | null>(null)
const isHoveringSelectionCount = useElementHover(selectionCountButtonRef)

// Total output count for all selected assets
const totalOutputCount = computed(() => {
  return getTotalOutputCount(selectedAssets.value)
})

// --- Merged assets from all active sources ---
const mergedAssets = computed(() => {
  const result: AssetItem[] = []
  if (activeSources.value.includes('output')) {
    result.push(...outputAssets.media.value)
  }
  if (activeSources.value.includes('input')) {
    result.push(...inputAssets.media.value)
  }
  for (const dir of savedCustomDirectories.value) {
    if (activeSources.value.includes(dir.id)) {
      const provider = customDirProviders.get(dir.id)
      if (provider) {
        result.push(...provider.media.value)
      }
    }
  }
  return result
})

const loading = computed(() => {
  for (const source of activeSources.value) {
    if (source === 'output' && outputAssets.loading.value) return true
    if (source === 'input' && inputAssets.loading.value) return true
    const provider = customDirProviders.get(source)
    if (provider?.loading.value) return true
  }
  return false
})

const galleryActiveIndex = ref(-1)
const currentGalleryAssetId = ref<string | null>(null)

const DEFAULT_SKELETON_COUNT = 6
const skeletonCount = computed(() =>
  expectedFolderCount.value > 0
    ? expectedFolderCount.value
    : DEFAULT_SKELETON_COUNT
)

const {
  state: folderAssets,
  isLoading: folderLoading,
  error: folderError,
  execute: loadFolderAssets
} = useAsyncState(
  (metadata: OutputAssetMetadata, options: { createdAt?: string } = {}) =>
    resolveOutputAssetItems(metadata, options),
  [] as AssetItem[],
  { immediate: false, resetOnExecute: true }
)

// Base assets before search filtering
const baseAssets = computed(() => {
  if (isInFolderView.value) {
    return folderAssets.value
  }
  return mergedAssets.value
})

// Use media asset filtering composable
const { searchQuery, sortBy, mediaTypeFilters, filteredAssets } =
  useMediaAssetFiltering(baseAssets)

// Apply date filtering using useAssetFilters
const assetFilters = useAssetFilters(filteredAssets)

// Sync persisted date range with filter composable
watch(
  dateRangeFilter,
  (newValue) => {
    assetFilters.dateRange.value = newValue
  },
  { immediate: true }
)

watch(
  () => assetFilters.dateRange.value,
  (newValue) => {
    dateRangeFilter.value = newValue
  }
)

const displayAssets = computed(() => {
  // Date filtering is already applied in assetFilters.filteredByDate
  if (assetFilters.hasActiveFilters.value) {
    return assetFilters.filteredByDate.value
  }
  return filteredAssets.value
})

const {
  assetItems: listViewAssetItems,
  selectableAssets: listViewSelectableAssets,
  isStackExpanded: isListViewStackExpanded,
  toggleStack: toggleListViewStack
} = useOutputStacks({
  assets: computed(() => displayAssets.value)
})

const visibleAssets = computed(() => {
  if (!isListView.value) return displayAssets.value
  return listViewSelectableAssets.value
})

const previewableVisibleAssets = computed(() =>
  visibleAssets.value.filter((asset) =>
    isPreviewableMediaType(getMediaTypeFromFilename(asset.name))
  )
)

const selectedAssets = computed(() => getSelectedAssets(visibleAssets.value))

const isBulkMode = computed(
  () => hasSelection.value && selectedAssets.value.length > 1
)

const isFolderLoading = computed(
  () => isInFolderView.value && folderLoading.value
)

const showLoadingState = computed(
  () =>
    (loading.value || isFolderLoading.value) && displayAssets.value.length === 0
)

const showEmptyState = computed(
  () =>
    !loading.value &&
    !isFolderLoading.value &&
    displayAssets.value.length === 0 &&
    (!currentFolders.value || currentFolders.value.length === 0)
)

const emptyStateTitle = computed(() => {
  if (activeSources.value.length === 0) return 'sideToolbar.noFilesFound'
  if (singleActiveSource.value === 'input') return 'sideToolbar.noImportedFiles'
  if (singleActiveSource.value === 'output')
    return 'sideToolbar.noGeneratedFiles'
  // Single custom directory or multiple sources
  if (
    singleActiveSource.value &&
    singleActiveSource.value !== 'input' &&
    singleActiveSource.value !== 'output'
  ) {
    return 'sideToolbar.noCustomFiles'
  }
  return 'sideToolbar.noFilesFound'
})

watch(visibleAssets, (newAssets) => {
  reconcileSelection(newAssets)
  if (currentGalleryAssetId.value && galleryActiveIndex.value !== -1) {
    const newIndex = previewableVisibleAssets.value.findIndex(
      (asset) => asset.id === currentGalleryAssetId.value
    )
    galleryActiveIndex.value = newIndex
  }
})

watch(galleryActiveIndex, (index) => {
  if (index === -1) {
    currentGalleryAssetId.value = null
  }
})

const galleryItems = computed(() => {
  return previewableVisibleAssets.value.map((asset) => {
    const mediaType = getMediaTypeFromFilename(asset.name)
    const resultItem = new ResultItemImpl({
      filename: asset.name,
      subfolder: '',
      type: 'output',
      nodeId: '0',
      mediaType: mediaType === 'image' ? 'images' : mediaType
    })

    Object.defineProperty(resultItem, 'url', {
      get() {
        return asset.preview_url || ''
      },
      configurable: true
    })

    return resultItem
  })
})

const refreshAssets = async () => {
  const promises: Promise<unknown>[] = []
  if (activeSources.value.includes('output')) {
    promises.push(outputAssets.fetchMediaList())
  }
  if (activeSources.value.includes('input')) {
    promises.push(inputAssets.fetchMediaList())
  }
  await Promise.all(promises)
}

// --- Source activation watcher ---
// Initial fetch for active sources
if (activeSources.value.includes('output')) {
  void outputAssets.fetchMediaList()
}
if (activeSources.value.includes('input')) {
  void inputAssets.fetchMediaList()
}

// Watch for source changes after initial setup
watch(activeSources, (newSources, oldSources) => {
  if (!oldSources) return

  const added = newSources.filter((s) => !oldSources.includes(s))

  for (const source of added) {
    if (source === 'output') {
      outputAssets.navigateToRoot()
      void outputAssets.fetchMediaList()
    } else if (source === 'input') {
      inputAssets.navigateToRoot()
      void inputAssets.fetchMediaList()
    } else if (!customDirProviders.has(source)) {
      // Custom dir checked but no provider — needs reconnection
      void reconnectCustomDir(source)
    }
  }

  clearSelection()
  if (isInFolderView.value) exitFolderView()
})

async function reconnectCustomDir(id: string) {
  const provider = useCustomDirectoryAssets()
  await provider.selectDirectory()

  if (provider.error.value) {
    const err = provider.error.value
    if (
      !(err instanceof Error && err.message === 'Directory selection cancelled')
    ) {
      toast.add({
        severity: 'error',
        summary: t('mediaAsset.directoryPicker.error'),
        detail: err instanceof Error ? err.message : String(err)
      })
    }
    activeSources.value = activeSources.value.filter((s) => s !== id)
    return
  }

  if (provider.navigationState.value.rootPath) {
    customDirProviders.set(id, provider)
    const name =
      provider.navigationState.value.rootPath.split('/').pop() || 'Custom'
    savedCustomDirectories.value = savedCustomDirectories.value.map((d) =>
      d.id === id ? { ...d, name } : d
    )
  } else {
    activeSources.value = activeSources.value.filter((s) => s !== id)
  }
}

function handleAssetSelect(asset: AssetItem, assets?: AssetItem[]) {
  const assetList = assets ?? visibleAssets.value
  const index = assetList.findIndex((a) => a.id === asset.id)
  emit('assetSelected', asset)
  handleAssetClick(asset, index, assetList)
}

const { start: scheduleCleanup, stop: cancelCleanup } = useTimeoutFn(
  () => {
    contextMenuAsset.value = null
  },
  0,
  { immediate: false }
)

function handleAssetContextMenu(event: MouseEvent, asset: AssetItem) {
  cancelCleanup()
  contextMenuAsset.value = asset
  void nextTick(() => {
    contextMenuRef.value?.show(event)
  })
}

function handleContextMenuHide() {
  scheduleCleanup()
}

const handleBulkDownload = (assets: AssetItem[]) => {
  downloadMultipleAssets(assets)
  clearSelection()
}

const handleBulkDelete = async (assets: AssetItem[]) => {
  if (await deleteAssets(assets)) {
    clearSelection()
  }
}

const handleBulkMove = async (assets: AssetItem[]) => {
  if (await moveAssets(assets)) {
    clearSelection()
  }
}

const handleBulkAddToWorkflow = async (assets: AssetItem[]) => {
  await addMultipleToWorkflow(assets)
  clearSelection()
}

const handleBulkOpenWorkflow = async (assets: AssetItem[]) => {
  await openMultipleWorkflows(assets)
  clearSelection()
}

const handleBulkExportWorkflow = async (assets: AssetItem[]) => {
  await exportMultipleWorkflows(assets)
  clearSelection()
}

const handleDownloadSelected = () => {
  downloadMultipleAssets(selectedAssets.value)
  clearSelection()
}

const handleDeleteSelected = async () => {
  if (await deleteAssets(selectedAssets.value)) {
    clearSelection()
  }
}

const handleZoomClick = (asset: AssetItem) => {
  const mediaType = getMediaTypeFromFilename(asset.name)
  if (!isPreviewableMediaType(mediaType)) {
    return
  }

  if (mediaType === '3D') {
    const dialogStore = useDialogStore()
    dialogStore.showDialog({
      key: 'asset-3d-viewer',
      title: getAssetDisplayName(asset),
      component: Load3dViewerContent,
      props: {
        modelUrl: asset.preview_url || ''
      },
      dialogComponentProps: {
        style: 'width: 80vw; height: 80vh;',
        maximizable: true
      }
    })
    return
  }

  currentGalleryAssetId.value = asset.id
  const index = previewableVisibleAssets.value.findIndex(
    (a) => a.id === asset.id
  )
  if (index !== -1) {
    galleryActiveIndex.value = index
  }
}

const enterFolderView = async (asset: AssetItem) => {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (!metadata) {
    console.warn('Invalid output asset metadata')
    return
  }

  const { jobId, executionTimeInSeconds } = metadata

  if (!jobId) {
    console.warn('Missing required folder view data')
    return
  }

  folderJobId.value = jobId
  folderExecutionTime.value = executionTimeInSeconds
  expectedFolderCount.value = metadata.outputCount ?? 0

  await loadFolderAssets(0, metadata, { createdAt: asset.created_at })

  if (folderError.value) {
    toast.add({
      severity: 'error',
      summary: t('sideToolbar.folderView.errorSummary'),
      detail: t('sideToolbar.folderView.errorDetail')
    })
    exitFolderView()
  }
}

const exitFolderView = () => {
  folderJobId.value = null
  folderExecutionTime.value = undefined
  expectedFolderCount.value = 0
  folderAssets.value = []
  searchQuery.value = ''
}

onMounted(() => {
  activateSelection()
})

onUnmounted(() => {
  deactivateSelection()
})

const handleDeselectAll = () => {
  clearSelection()
}

const handleEmptySpaceClick = () => {
  if (hasSelection) {
    clearSelection()
  }
}

const copyJobId = async () => {
  if (folderJobId.value) {
    try {
      await navigator.clipboard.writeText(folderJobId.value)
      toast.add({
        severity: 'success',
        summary: t('mediaAsset.jobIdToast.copied'),
        detail: t('mediaAsset.jobIdToast.jobIdCopied'),
        life: 2000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('mediaAsset.jobIdToast.error'),
        detail: t('mediaAsset.jobIdToast.jobIdCopyFailed')
      })
    }
  }
}

const handleApproachEnd = useDebounceFn(async () => {
  if (
    activeSources.value.includes('output') &&
    !isInFolderView.value &&
    outputAssets.hasMore.value &&
    !outputAssets.isLoadingMore.value
  ) {
    await outputAssets.loadMore()
  }
}, 300)

// --- Custom directory management ---
const handleAddDirectory = async () => {
  const provider = useCustomDirectoryAssets()
  await provider.selectDirectory()

  if (provider.error.value) {
    const err = provider.error.value
    if (err instanceof Error && err.message === 'Directory selection cancelled')
      return
    toast.add({
      severity: 'error',
      summary: t('mediaAsset.directoryPicker.error'),
      detail: err instanceof Error ? err.message : String(err)
    })
    return
  }

  if (provider.navigationState.value.rootPath) {
    const id = `custom-${Date.now()}`
    const name =
      provider.navigationState.value.rootPath.split('/').pop() || 'Custom'

    savedCustomDirectories.value = [
      ...savedCustomDirectories.value,
      { id, name }
    ]
    customDirProviders.set(id, provider)
    activeSources.value = [...activeSources.value, id]
  }
}

const handleRemoveDirectory = (id: string) => {
  savedCustomDirectories.value = savedCustomDirectories.value.filter(
    (d) => d.id !== id
  )
  activeSources.value = activeSources.value.filter((s) => s !== id)
  customDirProviders.delete(id)
}

// --- Folder navigation (single-source mode only) ---
const handleFolderClick = async (folder: FolderItem) => {
  if (!singleActiveSource.value) return

  if (
    singleActiveSource.value === 'output' ||
    singleActiveSource.value === 'input'
  ) {
    const assets =
      singleActiveSource.value === 'output' ? outputAssets : inputAssets
    assets.navigateInto(folder)
    return
  }

  // Custom directory navigation
  const provider = customDirProviders.get(singleActiveSource.value)
  if (provider) {
    try {
      await provider.navigateInto(folder.name)
    } catch (err) {
      toast.add({
        severity: 'error',
        summary: t('mediaAsset.folderNavigation.error'),
        detail: err instanceof Error ? err.message : 'Failed to navigate'
      })
    }
  }
}

const currentFolders = computed(() => {
  if (!showSubdirectories.value) return undefined
  if (!singleActiveSource.value) return undefined
  if (singleActiveSource.value === 'output') return outputAssets.folders.value
  if (singleActiveSource.value === 'input') return inputAssets.folders.value
  const provider = customDirProviders.get(singleActiveSource.value)
  return provider?.folders.value
})

const currentFolderPath = computed(() => {
  if (!singleActiveSource.value) return ''
  if (singleActiveSource.value === 'output')
    return outputAssets.currentPath.value
  if (singleActiveSource.value === 'input') return inputAssets.currentPath.value
  // Custom directory: derive subfolder path relative to root
  const provider = customDirProviders.get(singleActiveSource.value)
  if (provider) {
    const { rootPath, currentPath } = provider.navigationState.value
    if (rootPath && currentPath && currentPath !== rootPath) {
      // Return only the part after the root, e.g. "sub/folder"
      return currentPath.startsWith(rootPath + '/')
        ? currentPath.slice(rootPath.length + 1)
        : currentPath.split('/').slice(-1)[0] || ''
    }
  }
  return ''
})

const breadcrumbSegments = computed(() => {
  if (!currentFolderPath.value) return []
  return currentFolderPath.value.split('/')
})

const sentenceCase = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

const breadcrumbRootLabel = computed(() => {
  if (!singleActiveSource.value) return ''
  if (singleActiveSource.value === 'output') return 'Output'
  if (singleActiveSource.value === 'input') return 'Input'
  // Custom directory: use the saved name
  const dir = savedCustomDirectories.value.find(
    (d) => d.id === singleActiveSource.value
  )
  return sentenceCase(dir?.name || 'Custom')
})

const handleBreadcrumbNavigate = (index: number) => {
  if (!singleActiveSource.value) return

  if (
    singleActiveSource.value === 'output' ||
    singleActiveSource.value === 'input'
  ) {
    const assets =
      singleActiveSource.value === 'output' ? outputAssets : inputAssets
    if (index === -1) {
      assets.navigateToRoot()
    } else {
      const targetPath = breadcrumbSegments.value.slice(0, index + 1).join('/')
      assets.navigateInto({
        name: breadcrumbSegments.value[index],
        path: targetPath,
        type: 'folder'
      })
    }
    return
  }

  // Custom directory breadcrumb navigation
  const provider = customDirProviders.get(singleActiveSource.value)
  if (!provider) return

  if (index === -1) {
    void provider.navigateToRoot()
  }
  // Intermediate breadcrumb clicks are not supported for custom dirs
  // (the last segment is already disabled in the template)
}

const clearAllFilters = () => {
  assetFilters.clearFilters()
  dateRangeFilter.value = null
  mediaTypeFilters.value = []
}
</script>

<style scoped>
.assets-content-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.assets-main-content {
  flex: 1;
  overflow: auto;
  min-width: 0; /* Allow flex item to shrink below content size */
}

/* Match Toolbar horizontal padding to SidebarTopArea (p-2) for alignment */
:deep(.p-toolbar) {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

@media (min-width: 1536px) {
  :deep(.p-toolbar) {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}
</style>
