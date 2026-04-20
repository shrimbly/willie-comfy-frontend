<template>
  <div
    role="status"
    aria-live="polite"
    aria-atomic="false"
    :aria-label="t('moshpit.assets.processing', { done, total })"
    :class="
      cn(
        'absolute bottom-4 left-4 z-50 flex min-w-[180px] flex-col gap-1 rounded-lg border border-(--interface-stroke) bg-interface-panel-surface px-3 py-2 shadow-interface transition-opacity duration-200',
        isFading ? 'opacity-0' : 'opacity-100'
      )
    "
    data-testid="moshpit-processing-indicator"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs text-base-foreground">
        {{ t('moshpit.assets.processing', { done, total }) }}
      </span>
      <button
        type="button"
        :aria-label="t('moshpit.assets.cancel')"
        class="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary-background hover:text-base-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-(--interface-stroke)"
        @click="emit('cancel')"
      >
        <i class="icon-[lucide--x] size-4" aria-hidden="true" />
      </button>
    </div>
    <div
      role="progressbar"
      :aria-valuenow="done"
      :aria-valuemin="0"
      :aria-valuemax="total"
      :aria-label="t('moshpit.assets.processing', { done, total })"
      class="h-0.5 w-full overflow-hidden rounded-full bg-secondary-background"
    >
      <div
        class="h-full rounded-full bg-(--color-interface-panel-job-progress-primary) transition-[width] duration-300 ease-out"
        :style="{ width: progressPct + '%' }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitProcessingIndicator' })

const { done, total } = defineProps<{
  done: number
  total: number
}>()

const emit = defineEmits<{
  cancel: []
  done: []
}>()

const { t } = useI18n()

const progressPct = computed(() =>
  total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
)

const isFading = ref(false)
let holdTimer: ReturnType<typeof setTimeout> | null = null
let unmountTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => done === total && total > 0,
  (complete) => {
    if (!complete) {
      isFading.value = false
      if (holdTimer !== null) clearTimeout(holdTimer)
      if (unmountTimer !== null) clearTimeout(unmountTimer)
      return
    }
    holdTimer = setTimeout(() => {
      isFading.value = true
    }, 600)
    unmountTimer = setTimeout(() => {
      emit('done')
    }, 800)
  },
  { immediate: true }
)
</script>
