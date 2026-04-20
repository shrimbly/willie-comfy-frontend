<template>
  <div
    id="moshpit-canvas-container"
    ref="containerEl"
    tabindex="0"
    class="relative size-full overflow-hidden outline-none"
  >
    <MoshpitCanvas v-if="containerEl" :containerEl="containerEl" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import MoshpitCanvas from '@/platform/moshpit/components/MoshpitCanvas.vue'

defineOptions({ name: 'MoshpitView' })

const containerEl = ref<HTMLElement | null>(null)
</script>
