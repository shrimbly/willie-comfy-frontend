<template>
  <div class="flex flex-col gap-1.5 px-3 py-2">
    <div class="flex items-center justify-between">
      <span class="text-2xs tracking-wide text-muted-foreground uppercase">
        {{ t('moshpit.grouping.spacingLabel') }}
      </span>
      <span
        class="text-2xs text-muted-foreground tabular-nums"
        data-testid="moshpit-grid-spacing-value"
      >
        {{
          t('moshpit.grouping.spacingValue', {
            value: filterStore.gridSpacing
          })
        }}
      </span>
    </div>
    <Slider
      :model-value="[filterStore.gridSpacing]"
      :min="GRID_SPACING_MIN"
      :max="GRID_SPACING_MAX"
      :step="GRID_SPACING_STEP"
      :disabled="isDisabled"
      :aria-label="t('moshpit.grouping.spacingLabel')"
      data-testid="moshpit-grid-spacing-slider"
      @update:model-value="onSliderChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Slider from '@/components/ui/slider/Slider.vue'
import {
  GRID_SPACING_MAX,
  GRID_SPACING_MIN,
  GRID_SPACING_STEP,
  useMoshpitFilterStore
} from '@/platform/moshpit/stores/moshpitFilterStore'

defineOptions({ name: 'MoshpitGridSpacingControl' })

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()

// Disabled until the user has passed the filter gate (workflow / time range).
// Grid spacing only meaningfully affects the clustered layout once the canvas
// has assets to lay out — before the gate the viewport is empty and the
// control has no visible effect.
const isDisabled = computed(() => !filterStore.isGated)

function onSliderChange(values: number[] | undefined): void {
  if (values !== undefined && values[0] !== undefined) {
    filterStore.setGridSpacing(values[0])
  }
}
</script>
