<template>
  <CollapsibleRoot
    v-slot="{ open }"
    :open="filterStore.isAdvancedOpen"
    data-testid="moshpit-advanced-filters"
    @update:open="filterStore.setAdvancedOpen"
  >
    <CollapsibleTrigger as-child>
      <button
        type="button"
        :class="
          cn(
            'flex w-full items-center gap-1 text-2xs tracking-wide text-muted-foreground uppercase',
            'hover:text-base-foreground'
          )
        "
        data-testid="moshpit-advanced-filters-trigger"
      >
        <i
          :class="
            cn(
              'size-3',
              open ? 'icon-[lucide--chevron-up]' : 'icon-[lucide--chevron-down]'
            )
          "
          aria-hidden="true"
        />
        <span>{{ t('moshpit.filters.advancedLabel') }}</span>
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent data-testid="moshpit-advanced-filters-content">
      <div class="mt-1">
        <MoshpitFilterChipRow tier="advanced" />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import MoshpitFilterChipRow from './MoshpitFilterChipRow.vue'

defineOptions({ name: 'MoshpitAdvancedFilters' })

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()
</script>
