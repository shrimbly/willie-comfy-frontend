<template>
  <aside
    data-testid="moshpit-settings-panel"
    class="flex h-full w-64 flex-col border-r border-(--interface-stroke) bg-node-component-surface"
  >
    <header class="flex items-center justify-between px-3 py-2 text-sm">
      <span>{{ t('moshpit.sidebar.settings') }}</span>
    </header>
    <div class="flex-1 overflow-y-auto px-3 py-2 text-xs">
      <!-- Phase 3 fills with filter chips / sort controls / excluded-asset count -->
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'MoshpitSettingsPanel' })

const { t } = useI18n()
</script>
