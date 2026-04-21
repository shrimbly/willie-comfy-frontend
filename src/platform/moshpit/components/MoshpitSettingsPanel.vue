<template>
  <aside
    data-testid="moshpit-settings-panel"
    class="flex h-full w-64 flex-col border-r border-(--interface-stroke) bg-node-component-surface"
  >
    <header class="flex items-center justify-between px-3 py-2 text-sm">
      <span>{{ t('moshpit.sidebar.settings') }}</span>
    </header>
    <div class="flex-1 overflow-y-auto px-3 py-2 text-xs">
      <!-- Filter section (Phase 3 — FILTER-01, FILTER-08, FILTER-10) -->
      <section
        class="flex flex-col gap-2"
        :aria-label="t('moshpit.filters.sectionLabel')"
      >
        <span class="text-2xs tracking-wide text-muted-foreground uppercase">
          {{ t('moshpit.filters.sectionLabel') }}
        </span>
        <MoshpitWorkflowPicker />
        <MoshpitTimeRangePicker />
        <MoshpitFilterChipRow v-if="filterStore.isGated" />
      </section>

      <!-- Footer controls (SORT-04, FILTER-11) -->
      <div class="mt-4 flex flex-col gap-0">
        <MoshpitGridSpacingControl />
        <MoshpitShowHiddenToggle />
      </div>

      <!-- excluded-count row (ASSET-06) — preserved unchanged -->
      <div
        v-if="excludedCount > 0"
        class="mt-2 flex items-center gap-1"
        data-testid="moshpit-excluded-count"
      >
        <span :id="excludedDescId" class="text-muted-foreground">
          {{ t('moshpit.assets.excludedCount', excludedCount) }}
        </span>
        <i
          v-tooltip.top="t('moshpit.assets.excludedTooltip')"
          class="icon-[lucide--info] size-3.5 cursor-help text-muted-foreground"
          role="img"
          :aria-label="t('moshpit.assets.excludedTooltipLabel')"
          :aria-describedby="excludedDescId"
        />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import MoshpitFilterChipRow from '@/platform/moshpit/components/MoshpitFilterChipRow.vue'
import MoshpitGridSpacingControl from '@/platform/moshpit/components/MoshpitGridSpacingControl.vue'
import MoshpitShowHiddenToggle from '@/platform/moshpit/components/MoshpitShowHiddenToggle.vue'
import MoshpitTimeRangePicker from '@/platform/moshpit/components/MoshpitTimeRangePicker.vue'
import MoshpitWorkflowPicker from '@/platform/moshpit/components/MoshpitWorkflowPicker.vue'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'

defineOptions({ name: 'MoshpitSettingsPanel' })

const { t } = useI18n()
const metadataStore = useMoshpitMetadataStore()
const filterStore = useMoshpitFilterStore()
const excludedCount = computed(() => metadataStore.excludedCount)
const excludedDescId = useId()
</script>
