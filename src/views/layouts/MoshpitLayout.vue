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
import { useMoshpitFilteredAssets } from '@/platform/moshpit/composables/useMoshpitFilteredAssets'
import {
  MOSHPIT_LAYOUT_INJECTION_KEY
} from '@/platform/moshpit/composables/useMoshpitSpriteLayer'
import { getDateRangeForPreset } from '@/platform/moshpit/services/filterMath'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import {
  MOSHPIT_SETTINGS_PANEL_ID,
  useMoshpitSidebarStore
} from '@/platform/moshpit/stores/moshpitSidebarStore'
import WorkspaceAuthGate from '@/platform/workspace/auth/WorkspaceAuthGate.vue'
import { useAssetsStore } from '@/stores/assetsStore'
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

// Phase 3: provide the filtered-assets layout to MoshpitCanvas so the sprite
// layer tweens to filter/sort positions instead of the Phase 2 jittered grid.
const filteredAssets = useMoshpitFilteredAssets()
provide(MOSHPIT_LAYOUT_INJECTION_KEY, () =>
  filteredAssets.entries.value.map((e) => ({
    hash: e.contentHash,
    worldX: e.worldX,
    worldY: e.worldY
  }))
)

const showCompletionPulse = ref(false)

watch(
  () => queue.total.value > 0 && queue.done.value === queue.total.value,
  (complete) => {
    showCompletionPulse.value = complete
  }
)

// Phase 3: watch workflow + time range and call queue.setFilter so the asset
// pipeline activates when the user picks a workflow (FILTER-01 / D-06).
const filterStore = useMoshpitFilterStore()
const assetsStore = useAssetsStore()
const metaStore = useMoshpitMetadataStore()

watch(
  () => [filterStore.workflow, filterStore.timeRange] as const,
  ([workflow, timeRange]) => {
    // Gate: need a workflow OR a non-'all' time range (OR semantics — D-22).
    if (!workflow && timeRange.preset === 'all') return

    const nowMs = Date.now()
    const range = getDateRangeForPreset(timeRange.preset, nowMs)
    const fromMs =
      timeRange.preset === 'custom'
        ? (timeRange.from ?? -Infinity)
        : (range?.from ?? -Infinity)
    const toMs =
      timeRange.preset === 'custom'
        ? (timeRange.to ?? Infinity)
        : (range?.to ?? Infinity)

    // Filter assets by time window and (optionally) workflow fingerprint.
    // Un-processed assets (no params yet) are passed optimistically — the
    // in-memory filter (useMoshpitFilteredAssets) excludes fingerprint
    // mismatches once params arrive via thumbReady (D-06 best-effort).
    const candidates = assetsStore.outputJobAssets.filter((a) => {
      const created = a.created_at ? new Date(a.created_at).getTime() : 0
      if (!(created >= fromMs && created <= toMs)) return false
      if (!workflow) return true
      const hash = a.asset_hash ?? metaStore.getHashForAssetId(a.id)
      if (!hash) return true
      const params = metaStore.paramsByHash.get(hash)
      if (!params) return true
      return params.workflowFingerprint === workflow
    })

    const filterKey = `${workflow ?? ''}:${timeRange.preset}:${timeRange.from ?? ''}-${timeRange.to ?? ''}`
    void queue.setFilter(filterKey, candidates)
  },
  { immediate: false }
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
  // Moshpit is a peer of the Assets sidebar — users may land here directly
  // without ever opening the sidebar that normally populates outputJobAssets.
  // Trigger the fetch so the processing queue has candidates once a workflow
  // or time range is selected.
  void assetsStore.updateOutputJobs()
})
</script>
