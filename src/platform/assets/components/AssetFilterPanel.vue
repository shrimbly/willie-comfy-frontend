<template>
  <div class="asset-filter-panel">
    <div class="filter-header">
      <h3 class="filter-title">{{ $t('assets.filters.title') }}</h3>
      <Button
        v-if="hasActiveFilters"
        variant="text"
        size="small"
        class="filter-clear-all"
        @click="emit('clearFilters')"
      >
        {{ $t('assets.filters.clearAll') }}
      </Button>
    </div>

    <div class="filter-content">
      <!-- Date Range Filter Slot -->
      <slot name="dateRange">
        <DateRangeFilter
          :model-value="dateRange"
          @update:model-value="handleDateRangeChange"
          @clear="emit('clearFilters')"
        />
      </slot>

      <!-- Source Filter -->
      <div class="filter-section">
        <h4 class="filter-section-title">{{ $t('assets.filters.source') }}</h4>
        <div class="flex flex-col gap-0">
          <div
            v-for="source in sourceOptions"
            :key="source.id"
            class="group flex h-8 cursor-pointer items-center gap-2 rounded-lg px-3 hover:bg-secondary-background-hover"
            tabindex="0"
            role="radio"
            :aria-checked="activeSources.includes(source.id)"
            @click="selectSource(source.id)"
            @keydown.enter.prevent="selectSource(source.id)"
            @keydown.space.prevent="selectSource(source.id)"
          >
            <div
              class="flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200"
              :class="
                activeSources.includes(source.id)
                  ? 'border-primary-background'
                  : 'border-muted-foreground'
              "
            >
              <div
                v-if="activeSources.includes(source.id)"
                class="size-2 rounded-full bg-primary-background"
              />
            </div>
            <span class="flex-1 truncate text-xs" :title="source.label">{{
              source.label
            }}</span>
            <button
              v-if="source.removable"
              class="invisible size-4 shrink-0 cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground group-hover:visible hover:text-text-primary"
              @click.stop="emit('removeDirectory', source.id)"
            >
              <i class="icon-[lucide--x] text-xs" />
            </button>
          </div>
          <button
            class="flex h-8 cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-3 text-muted-foreground hover:bg-secondary-background-hover hover:text-text-primary"
            @click="emit('addDirectory')"
          >
            <i class="icon-[lucide--plus] text-xs" />
            <span class="text-xs">{{ $t('assets.filters.addDirectory') }}</span>
          </button>
        </div>
      </div>

      <!-- Media Type Filter -->
      <div class="filter-section">
        <h4 class="filter-section-title">{{ $t('assets.filters.type') }}</h4>
        <div class="flex flex-col gap-0">
          <div
            v-for="filter in availableFilters"
            :key="filter.type"
            class="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-3 hover:bg-secondary-background-hover"
            tabindex="0"
            role="checkbox"
            :aria-checked="mediaTypeFilters.includes(filter.type)"
            @click="toggleMediaType(filter.type)"
            @keydown.enter.prevent="toggleMediaType(filter.type)"
            @keydown.space.prevent="toggleMediaType(filter.type)"
          >
            <div
              class="flex size-4 shrink-0 items-center justify-center rounded-sm p-0.5 transition-all duration-200"
              :class="
                mediaTypeFilters.includes(filter.type)
                  ? 'border-primary-background bg-primary-background'
                  : 'bg-secondary-background'
              "
            >
              <i
                v-if="mediaTypeFilters.includes(filter.type)"
                class="icon-[lucide--check] text-xs font-bold text-white"
              />
            </div>
            <span class="text-xs">{{ $t(filter.label) }}</span>
          </div>
        </div>
      </div>

      <!-- Future filter slots can be added here -->
      <slot name="additionalFilters" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import DateRangeFilter from './DateRangeFilter.vue'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const { t } = useI18n()

const ALL_FILTERS = [
  { type: 'image', label: 'sideToolbar.mediaAssets.filterImage' },
  { type: 'video', label: 'sideToolbar.mediaAssets.filterVideo' },
  { type: 'audio', label: 'sideToolbar.mediaAssets.filterAudio' },
  { type: '3d', label: 'sideToolbar.mediaAssets.filter3D' }
] as const

interface CustomDirectory {
  id: string
  name: string
}

interface Props {
  dateRange?: [Date, Date] | null
  mediaTypeFilters?: string[]
  assets?: AssetItem[]
  activeSources?: string[]
  customDirectories?: CustomDirectory[]
}

interface Emits {
  (e: 'update:dateRange', value: [Date, Date] | null): void
  (e: 'update:mediaTypeFilters', value: string[]): void
  (e: 'update:activeSources', value: string[]): void
  (e: 'clearFilters'): void
  (e: 'addDirectory'): void
  (e: 'removeDirectory', id: string): void
}

const props = withDefaults(defineProps<Props>(), {
  mediaTypeFilters: () => [],
  assets: () => [],
  activeSources: () => ['output'],
  customDirectories: () => []
})
const emit = defineEmits<Emits>()

const sourceOptions = computed(() => {
  const options: Array<{ id: string; label: string; removable: boolean }> = [
    {
      id: 'output',
      label: t('sideToolbar.labels.generated'),
      removable: false
    },
    { id: 'input', label: t('sideToolbar.labels.imported'), removable: false }
  ]
  for (const dir of props.customDirectories) {
    options.push({ id: dir.id, label: dir.name, removable: true })
  }
  return options
})

const selectSource = (source: string) => {
  emit('update:activeSources', [source])
}

const presentMediaTypes = computed(() => {
  const types = new Set<string>()
  for (const asset of props.assets) {
    types.add(getMediaTypeFromFilename(asset.name).toLowerCase())
  }
  return types
})

const availableFilters = computed(() =>
  ALL_FILTERS.filter((f) => presentMediaTypes.value.has(f.type))
)

const hasActiveFilters = computed(() => {
  return (
    (props.dateRange !== null &&
      props.dateRange !== undefined &&
      props.dateRange.length === 2) ||
    props.mediaTypeFilters.length > 0
  )
})

const handleDateRangeChange = (value: [Date, Date] | null) => {
  emit('update:dateRange', value)
}

const toggleMediaType = (type: string) => {
  const isCurrentlySelected = props.mediaTypeFilters.includes(type)
  if (isCurrentlySelected) {
    emit(
      'update:mediaTypeFilters',
      props.mediaTypeFilters.filter((t) => t !== type)
    )
  } else {
    emit('update:mediaTypeFilters', [...props.mediaTypeFilters, type])
  }
}
</script>

<style scoped>
.asset-filter-panel {
  width: 180px;
  min-width: 180px;
  flex-shrink: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--p-content-border-color);
  background: var(--comfy-menu-bg);
  overflow: hidden;
}

.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: transparent;
}

.filter-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin: 0;
}

.filter-clear-all {
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
}

.filter-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.filter-section {
  padding: 0.5rem;
}

.filter-section-title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin: 0 0 0.25rem 0.25rem;
}

/* Mobile responsive - collapse to drawer */
@media (max-width: 768px) {
  .asset-filter-panel {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 100;
    box-shadow:
      0 4px 6px -1px rgb(0 0 0 / 0.3),
      0 2px 4px -2px rgb(0 0 0 / 0.3);
    background: var(--comfy-menu-bg);
  }
}
</style>
