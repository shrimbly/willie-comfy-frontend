<template>
  <div
    v-if="filters.length > 0"
    class="sticky top-0 z-10 flex flex-wrap gap-1 bg-base-background px-2 py-1.5 2xl:px-4"
  >
    <span
      v-for="filter in filters"
      :key="chipKey(filter)"
      class="inline-flex max-w-full items-center gap-1 rounded-md bg-base-foreground px-2 py-0.5 text-xs text-base-background"
    >
      <span class="shrink-0 opacity-70">
        {{ $t(`assets.metadata.${filter.field}`) }}:
      </span>
      <span
        v-tooltip.bottom="chipLabel(filter)"
        class="max-w-40 truncate font-medium"
      >
        {{ chipLabel(filter) }}
      </span>
      <button
        type="button"
        class="ml-0.5 inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0.5 text-base-background hover:bg-black/10"
        :aria-label="$t('g.remove')"
        @click.stop="removeFilter(filter)"
      >
        <i class="icon-[lucide--x] size-3" aria-hidden="true" />
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { MetadataFilter } from '@/platform/assets/types/metadataFilter'
import { formatMetadataFilterValue } from '@/platform/assets/utils/metadataFilterFormat'

const filters = defineModel<MetadataFilter[]>({ required: true })

const { t } = useI18n()

function chipKey(filter: MetadataFilter): string {
  return `${filter.field}:${filter.value}`
}

function chipLabel(filter: MetadataFilter): string {
  return formatMetadataFilterValue(t, filter.field, filter.value)
}

function removeFilter(filter: MetadataFilter) {
  const key = chipKey(filter)
  filters.value = filters.value.filter((f) => chipKey(f) !== key)
}
</script>
