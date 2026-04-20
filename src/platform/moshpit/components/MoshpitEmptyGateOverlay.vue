<template>
  <div
    v-if="!filterStore.isGated"
    class="pointer-events-none absolute inset-0 flex items-center justify-center"
    data-testid="moshpit-empty-gate-overlay"
  >
    <div class="flex max-w-80 flex-col items-center gap-3">
      <i
        class="icon-[lucide--grid-2x2] size-12 text-muted-foreground"
        aria-hidden="true"
      />
      <h2 class="text-sm font-medium text-base-foreground">
        {{ t('moshpit.filters.emptyStateHeading') }}
      </h2>
      <p class="text-center text-xs/relaxed text-muted-foreground">
        {{ t('moshpit.filters.emptyStateBody') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'

defineOptions({ name: 'MoshpitEmptyGateOverlay' })

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()
</script>
