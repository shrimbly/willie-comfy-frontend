<template>
  <div
    role="group"
    :aria-label="t('moshpit.grouping.sectionLabel')"
    class="flex flex-col gap-1"
    data-testid="moshpit-grouping-toggles"
  >
    <span class="text-2xs tracking-wide text-muted-foreground uppercase">
      {{ t('moshpit.grouping.sectionLabel') }}
    </span>
    <div class="flex flex-wrap gap-1">
      <button
        v-for="axis in GROUPING_AXES"
        :key="axis"
        v-tooltip.top="t(`moshpit.grouping.axisDescription.${axis}`)"
        type="button"
        :aria-pressed="
          filterStore.activeGroupings.includes(axis) ? 'true' : 'false'
        "
        :class="
          cn(
            'h-6 rounded-md px-2 text-xs',
            filterStore.activeGroupings.includes(axis)
              ? 'bg-node-component-primary text-base-foreground'
              : 'border border-(--interface-stroke) text-muted-foreground hover:text-base-foreground'
          )
        "
        :data-testid="`moshpit-grouping-toggle-${axis}`"
        @click="filterStore.toggleGrouping(axis)"
      >
        {{ t(`moshpit.grouping.axis.${axis}`) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'
import { GROUPING_AXES } from '@/platform/moshpit/services/groupAxes'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'

defineOptions({ name: 'MoshpitGroupingToggles' })

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()
</script>
