<template>
  <SidebarTabTemplate
    :title="
      hasLeftSidebar || showAllAssets ? '' : $t('sideToolbar.mediaAssets.title')
    "
    :class="hasLeftSidebar ? 'assets-tab-with-sidebar' : ''"
    v-bind="$attrs"
  >
    <template #alt-title>
      <!-- Folder view: job ID display (both modes) -->
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
      <!-- Advanced view title -->
      <div
        v-else-if="showAllAssets"
        class="flex w-full items-center justify-between gap-2"
      >
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
    </template>
    <template #body>
      <div
        :class="
          showAllAssets || showDetailPanel || showRecentsSidebar
            ? 'assets-content-layout'
            : 'contents'
        "
      >
        <!-- Left Folders Sidebar (advanced view, folders layout) -->
        <div
          v-if="hasLeftSidebar"
          class="relative flex h-full shrink-0 flex-col"
          :style="{ width: `${sidebarWidth}px` }"
        >
          <div
            class="flex h-18 shrink-0 items-center gap-2 bg-(--comfy-menu-bg) pr-3 pl-6"
            :title="$t('sideToolbar.mediaAssets.title')"
          >
            <i class="icon-[comfy--image-ai-edit] size-5 shrink-0" />
            <h2 class="text-neutral truncate text-base">
              {{ $t('sideToolbar.mediaAssets.title') }}
            </h2>
          </div>
          <div class="flex min-h-0 flex-1">
            <RecentsFoldersSidebar
              v-if="showRecentsSidebar"
              :output-tree="outputFolderTree"
              :input-tree="inputFolderTree"
              :selected-path="recentsSidebarSelectedPath"
              :pinned-paths="pinnedDirs"
              :recents-active="!showAllAssets && !favoritesActive"
              :favorites-active="favoritesActive"
              :favorite-color-filter="favoriteColorFilter"
              @select="handleRecentsSidebarSelect"
              @select-recents="handleRecentsSidebarRecents"
              @select-favorites="handleRecentsSidebarFavorites"
              @select-favorite-color="handleRecentsSidebarFavoriteColor"
              @update:pinned-paths="pinnedDirs = $event"
              @asset-drop-on-folder="handleAssetDropOnFolder"
            />
          </div>
          <!-- Resize handle -->
          <div
            class="absolute inset-y-0 right-0 z-10 w-1 -translate-x-1/2 cursor-col-resize hover:bg-primary/50"
            :class="isResizingSidebar && 'bg-primary/50'"
            @mousedown.prevent="startSidebarResize"
          >
            <div
              v-if="showRecentsSidebar"
              class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-comfy-input"
              aria-hidden="true"
            />
          </div>
        </div>
        <!-- Main Content Area -->
        <div
          :class="
            showAllAssets || showDetailPanel || showRecentsSidebar
              ? 'assets-main-content bg-base-background'
              : 'contents'
          "
        >
          <!-- Filter Bar -->
          <div :class="hasLeftSidebar ? 'flex h-18 flex-col pt-3' : 'contents'">
            <MediaAssetFilterBar
              v-model:search-query="searchQuery"
              v-model:sort-by="sortBy"
              v-model:view-mode="viewMode"
              v-model:hide-sidebar="hideRecentsSidebar"
              v-model:media-type-filters="mediaTypeFilters"
              v-model:metadata-filters="metadataFilters"
              v-model:composing="filterBarComposing"
              :bottom-divider="false"
              :show-generation-time-sort="activeSources.includes('output')"
              :available-tags="availableTags"
              :available-values-by-field="availableValuesByField"
            />
          </div>
          <!-- Active metadata filter chips -->
          <MediaAssetFilterChipsBar v-model="metadataFilters" />
          <!-- Detail panel toggle (default view) -->
          <div
            v-if="
              !showAllAssets &&
              !isInFolderView &&
              selectionStore.lastSelectedAssetId
            "
            class="sticky top-0 z-10 flex items-center justify-end border-b border-comfy-input bg-base-background px-2 py-1"
          >
            <Button
              variant="secondary"
              size="sm"
              @click="showDetailPanel = !showDetailPanel"
            >
              {{
                showDetailPanel
                  ? t('mediaAsset.details.hideDetails')
                  : t('mediaAsset.details.showDetails')
              }}
            </Button>
          </div>
          <!-- Breadcrumb navigation (shown when the recents sidebar collapses) -->
          <div
            v-if="
              showAllAssets &&
              !isInFolderView &&
              !showRecentsSidebar &&
              singleActiveSource &&
              metadataFilters.length === 0
            "
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
              <i
                class="icon-[lucide--chevron-right] size-3 shrink-0 text-muted-foreground/50"
                aria-hidden="true"
              />
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
                      @click="handleBreadcrumbItemClick(index, close)"
                    >
                      {{ sentenceCase(segment) }}
                    </button>
                  </div>
                </template>
              </Popover>
              <i
                class="icon-[lucide--chevron-right] size-3 shrink-0 text-muted-foreground/50"
                aria-hidden="true"
              />
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
              <i
                class="icon-[lucide--chevron-right] size-3 shrink-0 text-muted-foreground/50"
                aria-hidden="true"
              />
              <button
                class="truncate rounded-sm border-none bg-transparent px-1 py-0.5 font-medium text-text-primary transition-colors"
                disabled
              >
                {{ sentenceCase(breadcrumbSegments[0]) }}
              </button>
            </template>
            <Button
              v-if="selectionStore.lastSelectedAssetId"
              variant="secondary"
              size="sm"
              class="ml-auto shrink-0"
              @click="showDetailPanel = !showDetailPanel"
            >
              {{
                showDetailPanel
                  ? t('mediaAsset.details.hideDetails')
                  : t('mediaAsset.details.showDetails')
              }}
            </Button>
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
          <div v-else class="relative size-full" @click="handleEmptySpaceClick">
            <AssetsSidebarListView
              v-if="isListView"
              :asset-items="listViewAssetItems"
              :is-selected="isSelected"
              :selectable-assets="listViewSelectableAssets"
              :is-stack-expanded="isListViewStackExpanded"
              :toggle-stack="toggleListViewStack"
              :restrict-stack-favorites="showRecentsSidebar"
              v-bind="
                showAllAssets && !showRecentsSidebar
                  ? { folders: currentFolders }
                  : {}
              "
              @select-asset="handleAssetSelect"
              @preview-asset="handleZoomClick"
              @context-menu="handleAssetContextMenu"
              @approach-end="handleApproachEnd"
              @folder-click="handleFolderClick"
              @folder-context-menu="handleFolderContextMenu"
            />
            <AssetsSidebarGridView
              v-else
              :assets="displayAssets"
              :is-selected="isSelected"
              :show-output-count="shouldShowOutputCount"
              :get-output-count="getOutputCount"
              :grid-size="gridSize"
              :restrict-stack-favorites="showRecentsSidebar"
              v-bind="
                showAllAssets && !showRecentsSidebar
                  ? { folders: currentFolders }
                  : {}
              "
              @select-asset="handleAssetSelect"
              @folder-click="handleFolderClick"
              @folder-context-menu="handleFolderContextMenu"
              @context-menu="handleAssetContextMenu"
              @approach-end="handleApproachEnd"
              @zoom="handleZoomClick"
              @output-count-click="enterFolderView"
            />
          </div>
          <!-- Inline Selection Footer (anchored to bottom of main content column) -->
          <div
            v-if="hasSelection && hasLeftSidebar"
            ref="footerRef"
            class="sticky bottom-0 z-10 mt-auto flex h-18 w-full shrink-0 items-center justify-between gap-2 bg-base-background px-4"
          >
            <span class="truncate text-sm text-base-foreground">
              {{
                $t('mediaAsset.selection.selectedCountShort', {
                  count: totalOutputCount
                })
              }}
            </span>
            <div class="flex shrink items-center-safe justify-end-safe gap-2">
              <Button
                variant="secondary"
                data-testid="assets-select-all"
                @click="handleSelectAll"
              >
                <span>{{ $t('mediaAsset.selection.selectAll') }}</span>
              </Button>
              <Button
                variant="secondary"
                data-testid="assets-clear-selection"
                @click="handleDeselectAll"
              >
                <span>{{ $t('mediaAsset.selection.clear') }}</span>
              </Button>
              <template v-if="isCompact">
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
        </div>

        <!-- Right Detail Panel -->
        <AssetDetailPanel
          v-if="activeDetailAsset"
          :asset="activeDetailAsset"
          :prompt-metadata="detailPromptMeta"
        />
      </div>
    </template>
    <template #footer>
      <!-- Selection Footer (rendered here only when no left sidebar; otherwise inline in main content column) -->
      <div
        v-if="hasSelection && !hasLeftSidebar"
        ref="footerRef"
        class="flex h-18 w-full items-center justify-between gap-2 px-4"
      >
        <span class="truncate text-sm text-base-foreground">
          {{
            $t('mediaAsset.selection.selectedCountShort', {
              count: totalOutputCount
            })
          }}
        </span>
        <div class="flex shrink items-center-safe justify-end-safe gap-2">
          <Button
            variant="secondary"
            data-testid="assets-select-all"
            @click="handleSelectAll"
          >
            <span>{{ $t('mediaAsset.selection.selectAll') }}</span>
          </Button>
          <Button
            variant="secondary"
            data-testid="assets-clear-selection"
            @click="handleDeselectAll"
          >
            <span>{{ $t('mediaAsset.selection.clear') }}</span>
          </Button>
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
    :compare-items="compareItems"
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
    :allow-move-actions="showAllAssets"
    :show-directory-view-action="!showAllAssets"
    @zoom="handleZoomClick(contextMenuAsset)"
    @hide="handleContextMenuHide"
    @asset-deleted="refreshAssets"
    @show-in-directory-view="handleShowInDirectoryView"
    @bulk-download="handleBulkDownload"
    @bulk-move="handleBulkMove"
    @bulk-delete="handleBulkDelete"
    @bulk-add-to-workflow="handleBulkAddToWorkflow"
    @bulk-open-workflow="handleBulkOpenWorkflow"
    @bulk-export-workflow="handleBulkExportWorkflow"
    @bulk-compare="handleBulkCompare"
  />
  <FolderContextMenu
    v-if="contextMenuFolder"
    ref="folderContextMenuRef"
    :allow-move-actions="showAllAssets"
    @hide="handleFolderContextMenuHide"
    @open-in-finder="handleFolderOpenInFinder"
    @export-all="handleFolderExportAll"
    @move-to="handleFolderMoveTo"
  />
  <Teleport to="body">
    <div
      ref="dragPreviewWrapperRef"
      class="pointer-events-none fixed -top-[10000px] -left-[10000px]"
      aria-hidden="true"
    >
      <AssetDragPreview
        :thumbnails="dragPreviewThumbnails"
        :label="dragPreviewLabel"
        :content-visible="dragPreviewContentVisible"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {
  useAsyncState,
  useDebounceFn,
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
import AssetDragPreview from '@/platform/assets/components/AssetDragPreview.vue'
import AssetsSidebarGridView from '@/components/sidebar/tabs/AssetsSidebarGridView.vue'
import AssetsSidebarListView from '@/components/sidebar/tabs/AssetsSidebarListView.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/Popover.vue'
import AssetDetailPanel from '@/platform/assets/components/AssetDetailPanel.vue'
import FolderContextMenu from '@/platform/assets/components/FolderContextMenu.vue'
import MediaAssetContextMenu from '@/platform/assets/components/MediaAssetContextMenu.vue'
import MediaAssetFilterBar from '@/platform/assets/components/MediaAssetFilterBar.vue'
import MediaAssetFilterChipsBar from '@/platform/assets/components/MediaAssetFilterChipsBar.vue'
import RecentsFoldersSidebar from '@/platform/assets/components/RecentsFoldersSidebar.vue'
import { buildOutputFolderTree } from '@/platform/assets/utils/buildOutputFolderTree'
import type { ViewMode } from '@/platform/assets/components/MediaAssetFilterBar.vue'
import { getAssetType } from '@/platform/assets/composables/media/assetMappers'
import { useMediaAssets } from '@/platform/assets/composables/media/useMediaAssets'
import { useOutputJobsAssets } from '@/platform/assets/composables/media/useOutputJobsAssets'
import { useCustomDirectoryAssets } from '@/platform/assets/composables/media/useCustomDirectoryAssets'
import { useAssetFavorites } from '@/platform/assets/composables/useAssetFavorites'
import type { FavoriteColor } from '@/platform/assets/composables/useAssetFavorites'
import { useAssetDragPreview } from '@/platform/assets/composables/useAssetDragPreview'
import { useAssetPromptMetadata } from '@/platform/assets/composables/useAssetPromptMetadata'
import { useAssetSelection } from '@/platform/assets/composables/useAssetSelection'
import { useAssetSelectionStore } from '@/platform/assets/composables/useAssetSelectionStore'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { useMediaAssetFiltering } from '@/platform/assets/composables/useMediaAssetFiltering'
import { useAssetFilters } from '@/platform/assets/composables/useAssetFilters'
import { useOutputStacks } from '@/platform/assets/composables/useOutputStacks'
import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetDisplayName } from '@/platform/assets/utils/assetMetadataUtils'
import type { MetadataFilter } from '@/platform/assets/types/metadataFilter'
import type { PromptMetadata } from '@/platform/assets/utils/promptMetadataParser'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'
import type { FolderItem } from '@/utils/directoryPickerUtil'
import { isCloud } from '@/platform/distribution/types'
import { useAssetsStore } from '@/stores/assetsStore'
import { electronAPI } from '@/utils/envUtil'
import { useDialogStore } from '@/stores/dialogStore'
import { ResultItemImpl } from '@/stores/queueStore'
import {
  formatDuration,
  getMediaTypeFromFilename,
  isPreviewableMediaType
} from '@/utils/formatUtil'

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

// Tracks whether the user has navigated into a specific folder (vs. viewing
// recently generated assets across all folders).
const showAllAssets = useStorage<boolean>('Comfy.Assets.ShowAllAssets', false)
const favoritesActive = ref(false)
const favoriteColorFilter = ref<FavoriteColor | null>(null)

// Computed helper: which single source is active (null if 0 or 2+)
const singleActiveSource = computed(() => {
  if (activeSources.value.length === 1) return activeSources.value[0]
  return null
})

const folderJobId = ref<string | null>(null)
const folderExecutionTime = ref<number | undefined>(undefined)
const expectedFolderCount = ref(0)
const isInFolderView = computed(() => folderJobId.value !== null)
const viewMode = useStorage<ViewMode>(
  'Comfy.Assets.Sidebar.ViewMode',
  'grid-md'
)
const hideRecentsSidebar = useStorage<boolean>(
  'Comfy.Assets.HideRecentsSidebar',
  false
)

const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_MAX_WIDTH = 500
const sidebarWidth = useStorage<number>(
  'Comfy.Assets.FolderSidebarWidth.v3',
  SIDEBAR_MIN_WIDTH
)
const isResizingSidebar = ref(false)

function startSidebarResize(event: MouseEvent) {
  const startX = event.clientX
  const startWidth = sidebarWidth.value
  isResizingSidebar.value = true

  function onMove(e: MouseEvent) {
    const next = startWidth + (e.clientX - startX)
    sidebarWidth.value = Math.max(
      SIDEBAR_MIN_WIDTH,
      Math.min(SIDEBAR_MAX_WIDTH, next)
    )
  }
  function onUp() {
    isResizingSidebar.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
const pinnedDirs = useStorage<string[]>('Comfy.Assets.FolderSidebarPins.v2', [])
// True while the user is composing a filter in the search input (field picked,
// dropdown open, etc.). We collapse the folders sidebar in that window so it
// doesn't reappear between picking a field and typing its value.
const filterBarComposing = ref(false)
const showDetailPanel = useStorage<boolean>(
  'Comfy.Assets.ShowDetailPanel',
  false
)
const isListView = computed(() => viewMode.value === 'list')
const gridSize = computed<'sm' | 'md' | 'lg'>(() => {
  if (viewMode.value === 'grid-sm') return 'sm'
  if (viewMode.value === 'grid-lg') return 'lg'
  return 'md'
})

const contextMenuRef = ref<InstanceType<typeof MediaAssetContextMenu>>()
const contextMenuAsset = ref<AssetItem | null>(null)

const folderContextMenuRef = ref<InstanceType<typeof FolderContextMenu>>()
const contextMenuFolder = ref<FolderItem | null>(null)

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
const outputJobsAssets = useOutputJobsAssets()

// Default view uses jobs-based source (per-job stacks, generation-time sort,
// pagination); advanced view uses file-based source (folder nav, custom dirs).
const activeOutputSource = computed(() =>
  showAllAssets.value ? outputAssets : outputJobsAssets
)

// Apply pending folder navigation set before component remount.
// Changing showAllAssets changes the splitter key which destroys and recreates
// this component tree, so the handler stores the target in localStorage.
const PENDING_NAV_KEY = 'Comfy.Assets.PendingNav'
const pendingNavStr = localStorage.getItem(PENDING_NAV_KEY)
if (pendingNavStr) {
  localStorage.removeItem(PENDING_NAV_KEY)
  try {
    const { source, path } = JSON.parse(pendingNavStr) as {
      source: string
      path: string
    }
    const assets = source === 'output' ? outputAssets : inputAssets
    if (path) {
      assets.navigateInto({
        name: path.split('/').pop() || path,
        path,
        type: 'folder'
      })
    }
  } catch {
    // Ignore malformed pending navigation
  }
}

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
  selectAll,
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

// Total output count for all selected assets
const totalOutputCount = computed(() => {
  return getTotalOutputCount(selectedAssets.value)
})

// Filter refs — defined early so baseAssets can reference them
const searchQuery = ref('')
const metadataFilters = ref<MetadataFilter[]>([])
const mediaTypeFilters = ref<string[]>([])
const isSearchActive = computed(
  () =>
    searchQuery.value.trim() !== '' ||
    metadataFilters.value.length > 0 ||
    mediaTypeFilters.value.length > 0
)

// --- Merged assets from all active sources ---
function collectAssets(useAll: boolean): AssetItem[] {
  const result: AssetItem[] = []
  if (activeSources.value.includes('output')) {
    const source = activeOutputSource.value
    result.push(...(useAll ? source.allMedia : source.media).value)
  }
  if (activeSources.value.includes('input')) {
    result.push(...(useAll ? inputAssets.allMedia : inputAssets.media).value)
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
}

const mergedAssets = computed(() => collectAssets(false))
const allMergedAssets = computed(() => collectAssets(true))

const loading = computed(() => {
  for (const source of activeSources.value) {
    if (source === 'output' && activeOutputSource.value.loading.value)
      return true
    if (source === 'input' && inputAssets.loading.value) return true
    const provider = customDirProviders.get(source)
    if (provider?.loading.value) return true
  }
  return false
})

const galleryActiveIndex = ref(-1)
const currentGalleryAssetId = ref<string | null>(null)
const compareItems = ref<ResultItemImpl[]>([])

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

const favorites = useAssetFavorites()

// Base assets before search filtering
// When searching in directory mode, use all assets across all subdirectories
const baseAssets = computed(() => {
  if (favoritesActive.value) {
    const seen = new Set<string>()
    const unique: AssetItem[] = []
    for (const asset of allMergedAssets.value) {
      if (seen.has(asset.id)) continue
      seen.add(asset.id)
      unique.push(asset)
    }
    const favorited = favorites.favoritedAssets(unique)
    if (favoriteColorFilter.value) {
      return favorited.filter(
        (a) => favorites.getFavoriteColor(a) === favoriteColorFilter.value
      )
    }
    return favorited
  }
  if (isInFolderView.value) {
    return folderAssets.value
  }
  if (showAllAssets.value && isSearchActive.value) {
    return allMergedAssets.value
  }
  return mergedAssets.value
})

const availableTags = computed(() => {
  const tagSet = new Set<string>()
  for (const asset of baseAssets.value) {
    if (asset.tags) {
      for (const tag of asset.tags) {
        tagSet.add(tag)
      }
    }
  }
  return [...tagSet].sort()
})

// Prompt metadata extraction for @-filter search
const metadataExtractor = useAssetPromptMetadata()

const availableValuesByField = computed(() => ({
  model: metadataExtractor.getAvailableValues('model'),
  lora: metadataExtractor.getAvailableValues('lora'),
  workflowTitle: metadataExtractor.getAvailableValues('workflowTitle')
}))

// Detail panel — show info for last-clicked asset
const selectionStore = useAssetSelectionStore()

const activeDetailAsset = computed(() => {
  if (!showDetailPanel.value) return null
  const lastId = selectionStore.lastSelectedAssetId
  if (!lastId) return null
  return visibleAssets.value.find((a) => a.id === lastId) ?? null
})

const detailPromptMeta = ref<PromptMetadata | null>(null)

watch(activeDetailAsset, async (asset) => {
  if (!asset) {
    detailPromptMeta.value = null
    return
  }
  detailPromptMeta.value = await metadataExtractor.extractMetadata(asset)
})

// Use media asset filtering composable
const { sortBy, filteredAssets } = useMediaAssetFiltering(baseAssets, {
  metadataExtractor,
  searchQuery,
  metadataFilters,
  mediaTypeFilters
})

// Extract metadata in background when metadata filters are active, or when
// the advanced view is showing (so the @-filter type-ahead has real values
// to suggest for model/lora/vae).
watch(
  [metadataFilters, baseAssets, showAllAssets],
  ([filters, assets, advanced]) => {
    if (filters.length > 0 || advanced) {
      metadataExtractor.extractBatch(assets)
    }
  },
  { immediate: true }
)

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

const mockHiddenAssetIds = ref<Set<string>>(new Set())

const displayAssets = computed(() => {
  // Date filtering is already applied in assetFilters.filteredByDate
  const base = assetFilters.hasActiveFilters.value
    ? assetFilters.filteredByDate.value
    : filteredAssets.value
  if (mockHiddenAssetIds.value.size === 0) return base
  return base.filter((a) => !mockHiddenAssetIds.value.has(a.id))
})

const dragPreviewWrapperRef = ref<HTMLElement | null>(null)
const {
  thumbnails: dragPreviewThumbnails,
  label: dragPreviewLabel,
  contentVisible: dragPreviewContentVisible,
  setPreviewElement
} = useAssetDragPreview()

watch(
  dragPreviewWrapperRef,
  (el) => {
    setPreviewElement(el)
  },
  { immediate: true }
)

function handleAssetDropOnFolder(folderPath: string, assetIds: string[]) {
  if (assetIds.length === 0) return
  const next = new Set(mockHiddenAssetIds.value)
  for (const id of assetIds) next.add(id)
  mockHiddenAssetIds.value = next
  clearSelection()
  const folderName = folderPath.split('/').pop() || folderPath
  toast.add({
    severity: 'info',
    summary: t('mediaAsset.moveTo.dialogTitle'),
    detail: t('mediaAsset.dragMove.mockToast', {
      count: assetIds.length,
      folder: folderName
    }),
    life: 3000
  })
}

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
    compareItems.value = []
  }
})

function assetToResultItem(asset: AssetItem): ResultItemImpl {
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
}

const galleryItems = computed(() =>
  previewableVisibleAssets.value.map(assetToResultItem)
)

const refreshAssets = async () => {
  const promises: Promise<unknown>[] = []
  if (activeSources.value.includes('output')) {
    promises.push(activeOutputSource.value.fetchMediaList())
  }
  if (activeSources.value.includes('input')) {
    promises.push(inputAssets.fetchMediaList())
  }
  await Promise.all(promises)
}

// --- Source activation watcher ---
// Initial fetch for active sources
if (activeSources.value.includes('output')) {
  void activeOutputSource.value.fetchMediaList()
}
if (activeSources.value.includes('input')) {
  void inputAssets.fetchMediaList()
}

// Swap output data sources when the user toggles advanced view; fetch the
// newly-active source so the view isn't empty.
watch(showAllAssets, (isOn) => {
  if (activeSources.value.includes('output')) {
    void activeOutputSource.value.fetchMediaList()
  }

  if (isOn) return
  const first = activeSources.value[0]
  activeSources.value = [first === 'input' ? 'input' : 'output']
  if (viewMode.value === 'grid-sm' || viewMode.value === 'grid-lg') {
    viewMode.value = 'grid-md'
  }
  if (isInFolderView.value) exitFolderView()
})

// Watch for source changes after initial setup
watch(activeSources, (newSources, oldSources) => {
  if (!oldSources) return

  const added = newSources.filter((s) => !oldSources.includes(s))

  for (const source of added) {
    if (source === 'output') {
      outputAssets.navigateToRoot()
      void activeOutputSource.value.fetchMediaList()
    } else if (source === 'input') {
      inputAssets.navigateToRoot()
      void inputAssets.fetchMediaList()
    } else if (!customDirProviders.has(source)) {
      // Custom dir checked but no provider — needs reconnection
      void reconnectCustomDir(source)
    }
  }

  clearSelection()
  mockHiddenAssetIds.value = new Set()
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

const { start: scheduleFolderCleanup, stop: cancelFolderCleanup } =
  useTimeoutFn(
    () => {
      contextMenuFolder.value = null
    },
    0,
    { immediate: false }
  )

function handleFolderContextMenu(event: MouseEvent, folder: FolderItem) {
  cancelFolderCleanup()
  contextMenuFolder.value = folder
  void nextTick(() => {
    folderContextMenuRef.value?.show(event)
  })
}

function handleFolderContextMenuHide() {
  scheduleFolderCleanup()
}

function handleFolderOpenInFinder() {
  const source = singleActiveSource.value
  if (source === 'output') {
    electronAPI().openOutputsFolder()
  } else {
    electronAPI().openInputsFolder()
  }
}

const assetsStore = useAssetsStore()

function getAssetsInFolder(folder: FolderItem): AssetItem[] {
  const prefix = folder.path + '/'
  const source = singleActiveSource.value
  const allAssets =
    source === 'input' ? assetsStore.inputAssets : assetsStore.historyAssets
  return allAssets.filter((asset) => asset.name.startsWith(prefix))
}

function handleFolderExportAll() {
  if (!contextMenuFolder.value) return
  const assets = getAssetsInFolder(contextMenuFolder.value)
  if (assets.length > 0) {
    downloadMultipleAssets(assets)
  }
}

async function handleFolderMoveTo() {
  if (!contextMenuFolder.value) return
  const assets = getAssetsInFolder(contextMenuFolder.value)
  if (assets.length > 0) {
    await moveAssets(assets)
  }
}

function handleShowInDirectoryView() {
  if (!contextMenuAsset.value) return

  const asset = contextMenuAsset.value
  const assetName = asset.name
  const lastSlash = assetName.lastIndexOf('/')
  // Jobs view stores subfolder in user_metadata; file view embeds it in name
  const folderPath =
    lastSlash > 0
      ? assetName.substring(0, lastSlash)
      : (asset.user_metadata?.subfolder as string) || ''
  const source = contextMenuAssetType.value

  // Store navigation target before toggling showAllAssets.
  // Changing showAllAssets changes panelStateKeySuffix which changes the
  // splitter key, destroying and recreating this entire component tree.
  // The new instance reads this in setup and navigates.
  localStorage.setItem(
    PENDING_NAV_KEY,
    JSON.stringify({ source, path: folderPath })
  )
  showAllAssets.value = true
  activeSources.value = [source]
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

const handleBulkCompare = (assets: AssetItem[], totalSelected: number) => {
  if (assets.length < 2) return
  compareItems.value = assets.map(assetToResultItem)
  const excluded = totalSelected - assets.length
  if (excluded > 0) {
    toast.add({
      severity: 'info',
      summary: t('mediaAsset.compare.action'),
      detail: t('mediaAsset.compare.filteredToast', {
        n: assets.length,
        m: excluded
      }),
      life: 3500
    })
  }
  galleryActiveIndex.value = 0
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
  showDetailPanel.value = false
})

const handleDeselectAll = () => {
  clearSelection()
}

const handleSelectAll = () => {
  selectAll(visibleAssets.value)
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
    activeOutputSource.value.hasMore.value &&
    !activeOutputSource.value.isLoadingMore.value
  ) {
    await activeOutputSource.value.loadMore()
  }
}, 300)

// --- Folders sidebar (advanced view, folders layout) ---
const OUTPUT_ROOT_PATH = 'output'
const INPUT_ROOT_PATH = 'input'

const outputFolderTree = computed(() =>
  buildOutputFolderTree(
    assetsStore.historyAssets.map((a) => a.name),
    {
      name: t('sideToolbar.mediaAssets.foldersSidebar.outputRoot'),
      path: OUTPUT_ROOT_PATH
    }
  )
)

const inputFolderTree = computed(() =>
  buildOutputFolderTree(
    assetsStore.inputAssets.map((a) => a.name),
    {
      name: t('sideToolbar.mediaAssets.foldersSidebar.inputRoot'),
      path: INPUT_ROOT_PATH
    }
  )
)

const showRecentsSidebar = computed(
  () =>
    !hideRecentsSidebar.value &&
    !isInFolderView.value &&
    !isSearchActive.value &&
    !filterBarComposing.value
)

const hasLeftSidebar = showRecentsSidebar

const recentsSidebarSelectedPath = computed(() => {
  if (favoritesActive.value) return ''
  if (!showAllAssets.value) return ''
  const source = singleActiveSource.value
  if (source === 'output') {
    const rel = outputAssets.currentPath.value
    return rel ? `${OUTPUT_ROOT_PATH}/${rel}` : OUTPUT_ROOT_PATH
  }
  if (source === 'input') {
    const rel = inputAssets.currentPath.value
    return rel ? `${INPUT_ROOT_PATH}/${rel}` : INPUT_ROOT_PATH
  }
  return ''
})

const handleRecentsSidebarRecents = () => {
  favoritesActive.value = false
  favoriteColorFilter.value = null
  showAllAssets.value = false
}

const handleRecentsSidebarFavorites = () => {
  favoritesActive.value = true
  favoriteColorFilter.value = null
}

const handleRecentsSidebarFavoriteColor = (color: FavoriteColor | null) => {
  favoriteColorFilter.value = color
}

const handleRecentsSidebarSelect = (absolutePath: string) => {
  const isOutput =
    absolutePath === OUTPUT_ROOT_PATH ||
    absolutePath.startsWith(`${OUTPUT_ROOT_PATH}/`)
  const isInput =
    absolutePath === INPUT_ROOT_PATH ||
    absolutePath.startsWith(`${INPUT_ROOT_PATH}/`)
  if (!isOutput && !isInput) return

  const source = isOutput ? 'output' : 'input'
  const rootPath = isOutput ? OUTPUT_ROOT_PATH : INPUT_ROOT_PATH
  const rel =
    absolutePath === rootPath ? '' : absolutePath.slice(rootPath.length + 1)

  if (singleActiveSource.value !== source) {
    activeSources.value = [source]
  }
  favoritesActive.value = false
  favoriteColorFilter.value = null
  showAllAssets.value = true

  if (source === 'output') outputAssets.navigateToPath(rel)
  else inputAssets.navigateToPath(rel)
}

watch(
  showRecentsSidebar,
  (visible) => {
    if (!visible) return
    if (assetsStore.historyAssets.length === 0 && !assetsStore.historyLoading) {
      void assetsStore.updateHistory()
    }
    if (assetsStore.inputAssets.length === 0 && !assetsStore.inputLoading) {
      void assetsStore.updateInputs()
    }
  },
  { immediate: true }
)

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
  if (isSearchActive.value) return undefined
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

const handleBreadcrumbItemClick = (index: number, close: () => void) => {
  handleBreadcrumbNavigate(index)
  close()
}

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
</script>

<style scoped>
.assets-content-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
  border-radius: 1rem;
}

.assets-main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
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

/* When a left sidebar is visible, hide the top toolbar so the title can
   be rendered inside the sidebar column and the main column (search +
   options + grid) starts at the same top-vertical position as the title. */
.assets-tab-with-sidebar :deep(.comfy-vue-side-bar-header .p-toolbar) {
  display: none;
}
</style>
