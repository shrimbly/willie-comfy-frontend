<template>
  <div
    id="moshpit-canvas-container"
    ref="containerEl"
    tabindex="0"
    class="relative size-full overflow-hidden outline-none"
  >
    <p
      class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted"
    >
      {{ t('moshpit.canvas.emptyState') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'MoshpitView' })

const { t } = useI18n()
const containerEl = ref<HTMLElement | null>(null)

defineExpose({ containerEl })
</script>
