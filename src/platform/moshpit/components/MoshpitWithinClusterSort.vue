<template>
  <div class="flex flex-col gap-1" data-testid="moshpit-within-cluster-sort">
    <label
      :for="selectId"
      class="text-2xs tracking-wide text-muted-foreground uppercase"
    >
      {{ t('moshpit.grouping.withinSort.label') }}
    </label>
    <select
      :id="selectId"
      :value="filterStore.withinClusterSort"
      class="h-7 rounded-sm border border-(--interface-stroke) bg-base-background px-2 text-xs"
      @change="onChange"
    >
      <option
        v-for="mode in WITHIN_CLUSTER_SORT_MODES"
        :key="mode"
        :value="mode"
      >
        {{ t(`moshpit.grouping.withinSort.${mode}`) }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { WithinClusterSortMode } from '@/platform/moshpit/services/groupAxes'
import { WITHIN_CLUSTER_SORT_MODES } from '@/platform/moshpit/services/groupAxes'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'

defineOptions({ name: 'MoshpitWithinClusterSort' })

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()
const selectId = useId()

function onChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  filterStore.setWithinClusterSort(target.value as WithinClusterSortMode)
}
</script>
