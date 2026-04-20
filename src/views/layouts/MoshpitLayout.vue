<template>
  <WorkspaceAuthGate>
    <main
      class="relative flex size-full overflow-hidden bg-node-component-surface"
    >
      <MoshpitSideRail />
      <MoshpitSettingsPanel v-if="isSettingsOpen" />
      <div class="relative flex-1">
        <MoshpitView />
        <MoshpitProcessingIndicator
          v-if="queue.isActive.value || showCompletionPulse"
          :done="queue.done.value"
          :total="queue.total.value"
          @cancel="onCancel"
          @done="onIndicatorDone"
        />
      </div>
    </main>
  </WorkspaceAuthGate>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import MoshpitProcessingIndicator from '@/platform/moshpit/components/MoshpitProcessingIndicator.vue'
import MoshpitSettingsPanel from '@/platform/moshpit/components/MoshpitSettingsPanel.vue'
import MoshpitSideRail from '@/platform/moshpit/components/MoshpitSideRail.vue'
import { useMoshpitProcessingQueue } from '@/platform/moshpit/composables/useMoshpitProcessingQueue'
import {
  MOSHPIT_SETTINGS_PANEL_ID,
  useMoshpitSidebarStore
} from '@/platform/moshpit/stores/moshpitSidebarStore'
import WorkspaceAuthGate from '@/platform/workspace/auth/WorkspaceAuthGate.vue'
import MoshpitView from '@/views/MoshpitView.vue'

defineOptions({ name: 'MoshpitLayout' })

const sidebarStore = useMoshpitSidebarStore()
const isSettingsOpen = computed(
  () => sidebarStore.activePanelId === MOSHPIT_SETTINGS_PANEL_ID
)

const queue = useMoshpitProcessingQueue()
const showCompletionPulse = ref(false)

watch(
  () => queue.total.value > 0 && queue.done.value === queue.total.value,
  (complete) => {
    showCompletionPulse.value = complete
  }
)

function onCancel(): void {
  queue.cancel()
}

function onIndicatorDone(): void {
  showCompletionPulse.value = false
}

// The pre-Vue splash loader (#splash-loader in index.html) is removed by
// App.vue only when workspaceStore.spinner transitions true→false, which
// happens inside GraphCanvas.vue during the workflow route's boot. The
// Moshpit route never mounts GraphCanvas, so the splash stays forever and
// covers the (correctly rendered) Moshpit UI. Remove it on mount.
onMounted(() => {
  document.getElementById('splash-loader')?.remove()
})
</script>
