<template>
  <label
    class="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-base-foreground"
    data-testid="moshpit-show-hidden-label"
  >
    <button
      type="button"
      role="switch"
      :aria-checked="filterStore.showHidden"
      :aria-label="t('moshpit.sort.showHiddenLabel')"
      :class="
        cn(
          'relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:ring-offset-1',
          filterStore.showHidden
            ? 'bg-primary-background'
            : 'bg-secondary-background'
        )
      "
      data-testid="moshpit-show-hidden-toggle"
      @click="filterStore.setShowHidden(!filterStore.showHidden)"
    >
      <span
        :class="
          cn(
            'pointer-events-none block size-3 rounded-full bg-base-background shadow-sm ring-0 transition-transform',
            filterStore.showHidden ? 'translate-x-3' : 'translate-x-0'
          )
        "
        aria-hidden="true"
      />
    </button>
    <span>{{ t('moshpit.sort.showHiddenLabel') }}</span>
  </label>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'

defineOptions({ name: 'MoshpitShowHiddenToggle' })

const { t } = useI18n()
const filterStore = useMoshpitFilterStore()
</script>
