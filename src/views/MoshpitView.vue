<template>
  <div
    id="moshpit-canvas-container"
    ref="containerEl"
    tabindex="0"
    class="relative size-full overflow-hidden outline-none"
    @pointerdown="onContainerPointerDown"
  >
    <MoshpitCanvas v-if="containerEl" :containerEl="containerEl" />
    <MoshpitMarqueeOverlay
      :isDragging="marquee.isDragging.value"
      :overlayStyle="marquee.overlayStyle.value"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import MoshpitCanvas from '@/platform/moshpit/components/MoshpitCanvas.vue'
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
  sidebarStore.collapseOnFirstClick()
  marquee.onPointerDown(e)
}
</script>
