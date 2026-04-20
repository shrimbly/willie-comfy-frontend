<template>
  <WorkspaceAuthGate>
    <main
      class="relative flex size-full overflow-hidden bg-node-component-surface"
    >
      <MoshpitSideRail />
      <MoshpitSettingsPanel v-if="isSettingsOpen" />
      <div class="relative flex-1">
        <MoshpitView />
      </div>
    </main>
  </WorkspaceAuthGate>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

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

// The pre-Vue splash loader (#splash-loader in index.html) is removed by
// App.vue only when workspaceStore.spinner transitions true→false, which
// happens inside GraphCanvas.vue during the workflow route's boot. The
// Moshpit route never mounts GraphCanvas, so the splash stays forever and
// covers the (correctly rendered) Moshpit UI. Remove it on mount.
onMounted(() => {
  document.getElementById('splash-loader')?.remove()
})
</script>
