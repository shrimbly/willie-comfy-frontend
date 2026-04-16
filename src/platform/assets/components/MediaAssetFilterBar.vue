<template>
  <SidebarTopArea :bottom-divider>
    <SearchInput
      :model-value="searchQuery"
      :placeholder="
        $t('g.searchPlaceholder', { subject: $t('sideToolbar.labels.assets') })
      "
      @update:model-value="handleSearchChange"
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
            <i :class="viewModeIcon" />
          </Button>
        </template>
        <template #default>
          <div class="flex flex-col">
            <Button
              variant="textonly"
              class="w-full"
              @click="viewMode = 'list'"
            >
              <span class="flex items-center gap-2">
                <i class="icon-[lucide--list] size-4" />
                <span>{{ $t('assets.view.list') }}</span>
              </span>
              <i
                class="ml-auto icon-[lucide--check] size-4"
                :class="viewMode !== 'list' && 'opacity-0'"
              />
            </Button>
            <Button
              variant="textonly"
              class="w-full"
              @click="viewMode = 'grid-sm'"
            >
              <span class="flex items-center gap-2">
                <i class="icon-[lucide--grid-3x3] size-4" />
                <span>{{ $t('assets.view.gridSmall') }}</span>
              </span>
              <i
                class="ml-auto icon-[lucide--check] size-4"
                :class="viewMode !== 'grid-sm' && 'opacity-0'"
              />
            </Button>
            <Button
              variant="textonly"
              class="w-full"
              @click="viewMode = 'grid-md'"
            >
              <span class="flex items-center gap-2">
                <i class="icon-[lucide--layout-grid] size-4" />
                <span>{{ $t('assets.view.gridMedium') }}</span>
              </span>
              <i
                class="ml-auto icon-[lucide--check] size-4"
                :class="viewMode !== 'grid-md' && 'opacity-0'"
              />
            </Button>
            <Button
              variant="textonly"
              class="w-full"
              @click="viewMode = 'grid-lg'"
            >
              <span class="flex items-center gap-2">
                <i class="icon-[lucide--square] size-4" />
                <span>{{ $t('assets.view.gridLarge') }}</span>
              </span>
              <i
                class="ml-auto icon-[lucide--check] size-4"
                :class="viewMode !== 'grid-lg' && 'opacity-0'"
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
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { isCloud } from '@/platform/distribution/types'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'

export type SortBy = 'newest' | 'oldest' | 'longest' | 'fastest'
export type ViewMode = 'list' | 'grid-sm' | 'grid-md' | 'grid-lg'

const VIEW_MODE_ICONS: Record<ViewMode, string> = {
  list: 'icon-[lucide--list]',
  'grid-sm': 'icon-[lucide--grid-3x3]',
  'grid-md': 'icon-[lucide--layout-grid]',
  'grid-lg': 'icon-[lucide--square]'
}

const { showGenerationTimeSort = false, bottomDivider = false } = defineProps<{
  searchQuery: string
  showGenerationTimeSort?: boolean
  mediaTypeFilters: string[]
  bottomDivider?: boolean
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:mediaTypeFilters': [value: string[]]
}>()

const sortBy = defineModel<SortBy>('sortBy', { required: true })
const viewMode = defineModel<ViewMode>('viewMode', { required: true })

const viewModeIcon = computed(() => VIEW_MODE_ICONS[viewMode.value])

const handleSearchChange = (value: string | undefined) => {
  emit('update:searchQuery', value ?? '')
}

const handleMediaTypeFiltersChange = (value: string[]) => {
  emit('update:mediaTypeFilters', value)
}
</script>
