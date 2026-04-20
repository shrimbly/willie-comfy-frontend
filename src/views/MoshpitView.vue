<template>
  <div
    id="moshpit-canvas-container"
    ref="containerEl"
    tabindex="0"
    class="relative size-full overflow-hidden outline-none"
    @pointerdown="onContainerPointerDown"
  >
    <MoshpitCanvas v-if="containerEl" :container-el="containerEl" />
    <MoshpitAxisOverlay />
    <MoshpitEmptyGateOverlay />
    <MoshpitMarqueeOverlay
      :is-dragging="marquee.isDragging.value"
      :overlay-style="marquee.overlayStyle.value"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import MoshpitAxisOverlay from '@/platform/moshpit/components/MoshpitAxisOverlay.vue'
import MoshpitCanvas from '@/platform/moshpit/components/MoshpitCanvas.vue'
import MoshpitEmptyGateOverlay from '@/platform/moshpit/components/MoshpitEmptyGateOverlay.vue'
import MoshpitMarqueeOverlay from '@/platform/moshpit/components/MoshpitMarqueeOverlay.vue'
import { useMoshpitMarquee } from '@/platform/moshpit/composables/useMoshpitMarquee'
import { useMoshpitSidebarStore } from '@/platform/moshpit/stores/moshpitSidebarStore'

defineOptions({ name: 'MoshpitView' })

const containerEl = ref<HTMLElement | null>(null)
const sidebarStore = useMoshpitSidebarStore()

const marquee = useMoshpitMarquee({
  containerEl,
  hitTest: () => [] // Phase 1: no assets to hit-test; Phase 2 replaces this.
})

function onContainerPointerDown(e: PointerEvent) {
  containerEl.value?.focus()
  if (e.button === 0) sidebarStore.collapseOnFirstClick()
  marquee.onPointerDown(e)
}
</script>
