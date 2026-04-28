<template>
  <SidebarTopArea :bottom-divider>
    <MetadataSearchInput
      v-model:search-query="internalSearchQuery"
      v-model:metadata-filters="internalMetadataFilters"
      v-model:composing="composing"
      :available-tags="availableTags"
      :available-values-by-field="availableValuesByField"
    />
    <template #actions>
      <MediaAssetFilterButton
        v-if="isCloud"
        v-tooltip.top="{ value: $t('assetBrowser.filterBy') }"
      >
        <template #default="{ close }">
          <MediaAssetFilterMenu
            :media-type-filters
            :close
            @update:media-type-filters="handleMediaTypeFiltersChange"
          />
        </template>
      </MediaAssetFilterButton>

      <!-- Sort button -->
      <Popover>
        <template #button>
          <Button
            v-tooltip.top="$t('assets.sort.tooltip')"
            variant="secondary"
            size="icon"
          >
            <i class="icon-[lucide--arrow-down-up]" />
          </Button>
        </template>
        <template #default>
          <div class="flex flex-col">
            <Button
              variant="textonly"
              class="w-full"
              @click="sortBy = 'newest'"
            >
              <span>{{ $t('sideToolbar.mediaAssets.sortNewestFirst') }}</span>
              <i
                class="ml-auto icon-[lucide--check] size-4"
                :class="sortBy !== 'newest' && 'opacity-0'"
              />
            </Button>
            <Button
              variant="textonly"
              class="w-full"
              @click="sortBy = 'oldest'"
            >
              <span>{{ $t('sideToolbar.mediaAssets.sortOldestFirst') }}</span>
              <i
                class="ml-auto icon-[lucide--check] size-4"
                :class="sortBy !== 'oldest' && 'opacity-0'"
              />
            </Button>
            <template v-if="showGenerationTimeSort">
              <Button
                variant="textonly"
                class="w-full"
                @click="sortBy = 'longest'"
              >
                <span>{{
                  $t('sideToolbar.mediaAssets.sortLongestFirst')
                }}</span>
                <i
                  class="ml-auto icon-[lucide--check] size-4"
                  :class="sortBy !== 'longest' && 'opacity-0'"
                />
              </Button>
              <Button
                variant="textonly"
                class="w-full"
                @click="sortBy = 'fastest'"
              >
                <span>{{
                  $t('sideToolbar.mediaAssets.sortFastestFirst')
                }}</span>
                <i
                  class="ml-auto icon-[lucide--check] size-4"
                  :class="sortBy !== 'fastest' && 'opacity-0'"
                />
              </Button>
            </template>
          </div>
        </template>
      </Popover>

      <!-- View mode button -->
      <Popover>
        <template #button>
          <Button
            v-tooltip.top="$t('assets.view.tooltip')"
            variant="secondary"
            size="icon"
          >
            <i class="icon-[lucide--settings-2]" />
          </Button>
        </template>
        <template #default>
          <div class="flex flex-col">
            <Button
              v-for="option in ALL_VIEW_OPTIONS"
              :key="option.value"
              variant="textonly"
              class="w-full"
              @click="viewMode = option.value"
            >
              <span class="flex items-center gap-2">
                <i :class="option.icon" class="size-4" />
                <span>{{ $t(option.labelKey) }}</span>
              </span>
              <i
                class="ml-auto icon-[lucide--check] size-4"
                :class="viewMode !== option.value && 'opacity-0'"
              />
            </Button>
            <div class="my-1 border-t border-comfy-input" />
            <Button
              variant="textonly"
              class="w-full"
              @click="hideSidebar = !hideSidebar"
            >
              <span class="flex items-center gap-2">
                <i class="icon-[lucide--panel-left-close] size-4" />
                <span>{{ $t('assets.view.hideSidebar') }}</span>
              </span>
              <i
                class="ml-auto icon-[lucide--check] size-4"
                :class="!hideSidebar && 'opacity-0'"
              />
            </Button>
          </div>
        </template>
      </Popover>
    </template>
  </SidebarTopArea>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/Popover.vue'
import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import type { MetadataFilter } from '@/platform/assets/types/metadataFilter'
import { isCloud } from '@/platform/distribution/types'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import MetadataSearchInput from './MetadataSearchInput.vue'

type SortBy = 'newest' | 'oldest' | 'longest' | 'fastest'
export type ViewMode = 'list' | 'grid-sm' | 'grid-md' | 'grid-lg'

const {
  searchQuery,
  showGenerationTimeSort = false,
  mediaTypeFilters,
  metadataFilters,
  availableTags = [],
  availableValuesByField,
  bottomDivider = false
} = defineProps<{
  searchQuery: string
  showGenerationTimeSort?: boolean
  mediaTypeFilters: string[]
  metadataFilters: MetadataFilter[]
  availableTags?: string[]
  availableValuesByField?: Record<'model' | 'lora' | 'workflowTitle', string[]>
  bottomDivider?: boolean
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:mediaTypeFilters': [value: string[]]
  'update:metadataFilters': [value: MetadataFilter[]]
}>()

const sortBy = defineModel<SortBy>('sortBy', { required: true })
const viewMode = defineModel<ViewMode>('viewMode', { required: true })
const hideSidebar = defineModel<boolean>('hideSidebar', { default: false })
const composing = defineModel<boolean>('composing', { default: false })

interface ViewOption {
  value: ViewMode
  icon: string
  labelKey: string
}

const ALL_VIEW_OPTIONS: ViewOption[] = [
  { value: 'list', icon: 'icon-[lucide--list]', labelKey: 'assets.view.list' },
  {
    value: 'grid-sm',
    icon: 'icon-[lucide--grid-3x3]',
    labelKey: 'assets.view.gridSmall'
  },
  {
    value: 'grid-md',
    icon: 'icon-[lucide--layout-grid]',
    labelKey: 'assets.view.gridMedium'
  },
  {
    value: 'grid-lg',
    icon: 'icon-[lucide--square]',
    labelKey: 'assets.view.gridLarge'
  }
]

const internalSearchQuery = computed({
  get: () => searchQuery,
  set: (value: string) => emit('update:searchQuery', value)
})

const internalMetadataFilters = computed({
  get: () => metadataFilters,
  set: (value: MetadataFilter[]) => emit('update:metadataFilters', value)
})

const handleMediaTypeFiltersChange = (value: string[]) => {
  emit('update:mediaTypeFilters', value)
}
</script>
