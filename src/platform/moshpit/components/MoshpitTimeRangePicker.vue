<template>
  <div class="flex flex-col gap-2">
    <span class="text-2xs tracking-wide text-muted-foreground uppercase">
      {{ t('moshpit.filters.timeRangeLabel') }}
    </span>

    <div
      class="flex flex-wrap gap-1"
      role="radiogroup"
      :aria-label="t('moshpit.filters.timeRangeLabel')"
    >
      <button
        v-for="preset in TIME_PRESETS"
        :key="preset"
        type="button"
        role="radio"
        :aria-checked="filterStore.timeRange.preset === preset"
        :class="
          cn(
            'h-6 rounded-full px-2 text-xs',
            filterStore.timeRange.preset === preset
              ? 'bg-secondary-background-selected text-base-foreground'
              : 'bg-secondary-background text-muted-foreground hover:bg-secondary-background-hover'
          )
        "
        @click="selectPreset(preset)"
      >
        {{ presetLabel(preset) }}
      </button>
    </div>

    <div
      v-if="filterStore.timeRange.preset === 'custom'"
      class="flex flex-col gap-1"
    >
      <label class="flex items-center gap-2">
        <span class="w-10 text-2xs tracking-wide text-muted-foreground uppercase">
          {{ t('moshpit.filters.timeRangeFrom') }}
        </span>
        <input
          type="date"
          :aria-label="t('moshpit.filters.timeRangeFrom')"
          :value="epochToISODate(filterStore.timeRange.from)"
          class="h-8 flex-1 rounded-md border border-border-subtle bg-transparent px-2 text-xs text-base-foreground"
          @change="onFromChange"
        />
      </label>

      <label class="flex items-center gap-2">
        <span class="w-10 text-2xs tracking-wide text-muted-foreground uppercase">
          {{ t('moshpit.filters.timeRangeTo') }}
        </span>
        <input
          type="date"
          :aria-label="t('moshpit.filters.timeRangeTo')"
          :value="epochToISODate(filterStore.timeRange.to)"
          class="h-8 flex-1 rounded-md border border-border-subtle bg-transparent px-2 text-xs text-base-foreground"
          @change="onToChange"
        />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'
import { TIME_PRESETS } from '@/platform/moshpit/services/filterTypes'
import type { TimePreset } from '@/platform/moshpit/services/filterTypes'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'

defineOptions({ name: 'MoshpitTimeRangePicker' })

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()

const PRESET_I18N_KEY: Record<TimePreset, string> = {
  today: 'moshpit.filters.timeRangeToday',
  thisWeek: 'moshpit.filters.timeRangeThisWeek',
  thisMonth: 'moshpit.filters.timeRangeThisMonth',
  all: 'moshpit.filters.timeRangeAllTime',
  custom: 'moshpit.filters.timeRangeCustom'
}

function presetLabel(preset: TimePreset): string {
  return t(PRESET_I18N_KEY[preset])
}

function selectPreset(preset: TimePreset): void {
  filterStore.setTimeRange({ preset, from: null, to: null })
}

function epochToISODate(epochMs: number | null): string {
  if (epochMs === null || !Number.isFinite(epochMs)) return ''
  return new Date(epochMs).toISOString().slice(0, 10)
}

function isoDateToEpoch(isoDate: string): number | null {
  if (!isoDate) return null
  const ms = new Date(`${isoDate}T00:00:00Z`).getTime()
  return Number.isFinite(ms) ? ms : null
}

function onFromChange(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  filterStore.setTimeRange({
    preset: 'custom',
    from: isoDateToEpoch(value),
    to: filterStore.timeRange.to
  })
}

function onToChange(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  filterStore.setTimeRange({
    preset: 'custom',
    from: filterStore.timeRange.from,
    to: isoDateToEpoch(value)
  })
}
</script>
