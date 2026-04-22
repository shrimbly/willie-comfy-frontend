<template>
  <div
    id="moshpit-canvas-container"
    ref="containerEl"
    data-testid="moshpit-canvas-container"
    tabindex="0"
    class="relative size-full overflow-hidden outline-none"
    @pointerdown="onContainerPointerDown"
    @keydown="onContainerKeydown"
  >
    <MoshpitCanvas v-if="containerEl" :container-el="containerEl" />
    <MoshpitClusterOverlay />
    <MoshpitEmptyGateOverlay />
    <MoshpitMarqueeOverlay
      :is-dragging="marquee.isDragging.value"
      :overlay-style="marquee.overlayStyle.value"
    />
    <MoshpitTournamentOverlay :resolve-full-res-url="resolveFullResUrl" />
  </div>
</template>

<script setup lang="ts">
import type { Viewport } from 'pixi-viewport'
import { provide, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { getAssetUrl } from '@/platform/assets/utils/assetUrlUtil'
import MoshpitCanvas from '@/platform/moshpit/components/MoshpitCanvas.vue'
import MoshpitClusterOverlay from '@/platform/moshpit/components/MoshpitClusterOverlay.vue'
import MoshpitEmptyGateOverlay from '@/platform/moshpit/components/MoshpitEmptyGateOverlay.vue'
import MoshpitMarqueeOverlay from '@/platform/moshpit/components/MoshpitMarqueeOverlay.vue'
import MoshpitTournamentOverlay from '@/platform/moshpit/components/MoshpitTournamentOverlay.vue'
import { useMoshpitMarquee } from '@/platform/moshpit/composables/useMoshpitMarquee'
import { MOSHPIT_VIEWPORT_INJECTION_KEY } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useMoshpitSidebarStore } from '@/platform/moshpit/stores/moshpitSidebarStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAssetsStore } from '@/stores/assetsStore'

defineOptions({ name: 'MoshpitView' })

const containerEl = ref<HTMLElement | null>(null)

const viewportRef = shallowRef<Viewport | null>(null)
provide(MOSHPIT_VIEWPORT_INJECTION_KEY, viewportRef)
const sidebarStore = useMoshpitSidebarStore()
const selectionStore = useMoshpitSelectionStore()
const tournamentStore = useMoshpitTournamentStore()
const metadataStore = useMoshpitMetadataStore()
const assetsStore = useAssetsStore()
const toastStore = useToastStore()
const { t } = useI18n()

const marquee = useMoshpitMarquee({
  containerEl,
  hitTest: () => [] // Phase 1: no assets to hit-test; Phase 2 replaces this.
})

/**
 * Tournament full-res URL resolver. Looks up an asset by contentHash and
 * returns its `/view?filename=...` URL via getAssetUrl. OSS-path assets have
 * `asset_hash === null` — we bridge via `metadataStore.getHashForAssetId`
 * mirroring `useMoshpitAssetRegistry`.
 *
 * Returns `null` for hashes not resolvable; preload skips nulls gracefully.
 */
function resolveFullResUrl(hash: string): string | null {
  for (const asset of assetsStore.historyAssets) {
    const assetHash =
      asset.asset_hash ?? metadataStore.getHashForAssetId(asset.id) ?? null
    if (assetHash === hash) return getAssetUrl(asset)
  }
  return null
}

function onContainerPointerDown(e: PointerEvent) {
  containerEl.value?.focus()
  if (e.button === 0) sidebarStore.collapseOnFirstClick()
  // Marquee selection is gated on shift-click so it doesn't steal the
  // pointer from pixi-viewport's left-click-drag pan (Phase 3 Core Value).
  if (e.shiftKey) marquee.onPointerDown(e)
}

function onContainerKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter') return
  if (tournamentStore.isActive) return
  if (selectionStore.size < 2) {
    toastStore.add({
      severity: 'info',
      summary: t('moshpit.tournament.needTwoToastSummary'),
      detail: t('moshpit.tournament.needTwoToastDetail')
    })
    e.preventDefault()
    return
  }
  tournamentStore.enter(selectionStore.selected, resolveFullResUrl)
  e.preventDefault()
}
</script>
