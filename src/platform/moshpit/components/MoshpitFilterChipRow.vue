<template>
  <div
    class="flex flex-col gap-1"
    role="group"
    :aria-label="t('moshpit.filters.sectionLabel')"
  >
    <div class="flex flex-wrap gap-1">
      <div
        v-for="chip in tierChips"
        :key="chip.id"
        :class="
          cn(
            'inline-flex h-6 items-center gap-1 rounded-md bg-secondary-background px-2 text-xs'
          )
        "
        data-testid="moshpit-filter-chip"
      >
        <span class="max-w-[120px] truncate text-base-foreground">
          {{ chipLabel(chip) }}
        </span>
        <span class="text-muted-foreground">{{ chipValueSummary(chip) }}</span>
        <button
          type="button"
          :class="
            cn(
              'size-5 rounded-sm text-muted-foreground',
              'hover:bg-secondary-background-hover hover:text-base-foreground',
              'focus-visible:ring-1 focus-visible:ring-primary-background'
            )
          "
          :aria-label="
            t('moshpit.filters.removeChip', { param: chipLabel(chip) })
          "
          @click="filterStore.removeChip(chip.id)"
        >
          <i class="icon-[lucide--x] size-3" aria-hidden="true" />
        </button>
      </div>
      <MoshpitAddFilterPopover />
    </div>
    <span class="sr-only" role="status" aria-live="polite">
      {{
        t(
          'moshpit.filters.chipCount',
          { count: tierChips.length },
          tierChips.length
        )
      }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import type {
  FilterChip,
  ParamKey
} from '@/platform/moshpit/services/filterTypes'
import {
  ADVANCED_FILTER_PARAMS,
  PRIMARY_FILTER_PARAMS
} from '@/platform/moshpit/services/filterTypes'
import MoshpitAddFilterPopover from './MoshpitAddFilterPopover.vue'

defineOptions({ name: 'MoshpitFilterChipRow' })

const { tier = 'primary' } = defineProps<{
  tier?: 'primary' | 'advanced'
}>()

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()

const tierParams = computed<readonly ParamKey[]>(() =>
  tier === 'advanced' ? ADVANCED_FILTER_PARAMS : PRIMARY_FILTER_PARAMS
)

const tierChips = computed(() =>
  filterStore.chips.filter((c) => tierParams.value.includes(c.param))
)

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
