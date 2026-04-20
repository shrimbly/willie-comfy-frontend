<template>
  <WorkspaceAuthGate>
    <main class="relative flex size-full overflow-hidden bg-node-component-surface">
      <MoshpitSideRail />
      <MoshpitSettingsPanel v-if="isSettingsOpen" />
      <div class="relative flex-1">
        <MoshpitView />
      </div>
    </main>
  </WorkspaceAuthGate>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import WorkspaceAuthGate from '@/platform/workspace/auth/WorkspaceAuthGate.vue'
import MoshpitSettingsPanel from '@/platform/moshpit/components/MoshpitSettingsPanel.vue'
import MoshpitSideRail from '@/platform/moshpit/components/MoshpitSideRail.vue'
import {
  MOSHPIT_SETTINGS_PANEL_ID,
  useMoshpitSidebarStore
} from '@/platform/moshpit/stores/moshpitSidebarStore'
import MoshpitView from '@/views/MoshpitView.vue'

defineOptions({ name: 'MoshpitLayout' })

const sidebarStore = useMoshpitSidebarStore()
const isSettingsOpen = computed(
  () => sidebarStore.activePanelId === MOSHPIT_SETTINGS_PANEL_ID
)
</script>
