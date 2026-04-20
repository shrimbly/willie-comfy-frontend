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
import { computed, onMounted, provide, ref, watch } from 'vue'

import MoshpitProcessingIndicator from '@/platform/moshpit/components/MoshpitProcessingIndicator.vue'
import MoshpitSettingsPanel from '@/platform/moshpit/components/MoshpitSettingsPanel.vue'
import MoshpitSideRail from '@/platform/moshpit/components/MoshpitSideRail.vue'
import {
  MOSHPIT_QUEUE_INJECTION_KEY,
  useMoshpitProcessingQueue
} from '@/platform/moshpit/composables/useMoshpitProcessingQueue'
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
// Provide the single queue instance to MoshpitCanvas (via MoshpitView) so it
// can pass it to useMoshpitSpriteLayer without a second WorkerBridge being
// created. Option B (provide/inject) chosen over prop-drilling because
// MoshpitView has its own marquee + sidebar logic that makes prop threading awkward.
provide(MOSHPIT_QUEUE_INJECTION_KEY, queue)
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
