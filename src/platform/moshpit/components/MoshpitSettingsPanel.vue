<template>
  <aside
    data-testid="moshpit-settings-panel"
    class="flex h-full w-64 flex-col border-r border-(--interface-stroke) bg-node-component-surface"
  >
    <header class="flex items-center justify-between px-3 py-2 text-sm">
      <span>{{ t('moshpit.sidebar.settings') }}</span>
    </header>
    <div class="flex-1 overflow-y-auto px-3 py-2 text-xs">
      <!-- Phase 3 will inject filter chips / sort controls ABOVE this comment. -->
      <!-- excluded-count row below is the ASSET-06 surface. -->
      <div
        v-if="excludedCount > 0"
        class="flex items-center gap-1"
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

import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'

defineOptions({ name: 'MoshpitSettingsPanel' })

const { t } = useI18n()
const metadataStore = useMoshpitMetadataStore()
const excludedCount = computed(() => metadataStore.excludedCount)
const excludedDescId = useId()
</script>
