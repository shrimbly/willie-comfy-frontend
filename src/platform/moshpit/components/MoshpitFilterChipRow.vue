<template>
  <div
    class="flex flex-col gap-2"
    role="group"
    :aria-label="t('moshpit.filters.sectionLabel')"
  >
    <MoshpitAddFilterPopover variant="block" />
    <div v-if="chips.length > 0" class="flex flex-col gap-1">
      <div
        v-for="chip in chips"
        :key="chip.id"
        class="flex items-center gap-1 rounded-md bg-secondary-background px-2 py-1 text-xs"
        data-testid="moshpit-filter-chip"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="text-2xs tracking-wide text-muted-foreground uppercase">
            {{ chipLabel(chip) }}
          </span>
          <span class="min-w-0 truncate text-xs text-base-foreground">
            {{ chipValueSummary(chip) }}
          </span>
        </div>
        <button
          type="button"
          :class="
            cn(
              'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center text-muted-foreground',
              'hover:text-base-foreground',
              'focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)'
            )
          "
          :aria-label="
            t('moshpit.filters.removeChip', { param: chipLabel(chip) })
          "
          @click="filterStore.removeChip(chip.id)"
        >
          <i class="icon-[lucide--x] size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
    <span class="sr-only" role="status" aria-live="polite">
      {{
        t('moshpit.filters.chipCount', { count: chips.length }, chips.length)
      }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import type { FilterChip } from '@/platform/moshpit/services/filterTypes'
import MoshpitAddFilterPopover from './MoshpitAddFilterPopover.vue'

defineOptions({ name: 'MoshpitFilterChipRow' })

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()

const chips = computed(() => filterStore.chips)

function chipLabel(chip: FilterChip): string {
  switch (chip.param) {
    case 'positivePrompt':
      return t('moshpit.filters.paramPrompt')
    case 'negativePrompt':
      return t('moshpit.filters.paramNegativePrompt')
    case 'timestamp':
      return t('moshpit.filters.paramGenerationTime')
    case 'width':
    case 'height':
    case 'resolution':
      return t('moshpit.filters.paramResolution')
    default: {
      const key = `moshpit.filters.param${chip.param.charAt(0).toUpperCase()}${chip.param.slice(1)}`
      return t(key)
    }
  }
}

function chipValueSummary(chip: FilterChip): string {
  switch (chip.value.kind) {
    case 'categorical': {
      if (chip.value.values.length === 0) return ''
      if (chip.value.values.length === 1) return chip.value.values[0]
      return `${chip.value.values[0]} +${chip.value.values.length - 1}`
    }
    case 'numeric': {
      if (chip.value.exact !== null) return `= ${chip.value.exact}`
      const min = chip.value.min === null ? '' : String(chip.value.min)
      const max = chip.value.max === null ? '' : String(chip.value.max)
      return `${min}\u2013${max}`
    }
    case 'text':
      return `"${chip.value.substring}"`
    case 'resolution': {
      if (chip.value.pairs.length === 0) return ''
      const first = `${chip.value.pairs[0][0]}\u00d7${chip.value.pairs[0][1]}`
      return chip.value.pairs.length === 1
        ? first
        : `${first} +${chip.value.pairs.length - 1}`
    }
    case 'boolean':
      return chip.value.value ? t('moshpit.filters.paramFavourite') : ''
  }
}
</script>
