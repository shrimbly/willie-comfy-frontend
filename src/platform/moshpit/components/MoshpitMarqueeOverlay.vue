<template>
  <div
    v-if="isDragging"
    :style="overlayStyle"
    class="border border-dashed border-(--interface-stroke) bg-node-component-surface/20"
    data-testid="moshpit-marquee"
  />
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'

defineOptions({ name: 'MoshpitMarqueeOverlay' })

const { isDragging, overlayStyle } = defineProps<{
  isDragging: boolean
  overlayStyle: CSSProperties
}>()
</script>
