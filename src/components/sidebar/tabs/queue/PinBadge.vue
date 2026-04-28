<template>
  <button
    type="button"
    :aria-label="label"
    :aria-pressed="pinned"
    :class="
      cn(
        'pointer-events-auto inline-flex size-6 shrink-0 items-center justify-center rounded-full border-none transition-colors',
        pinned
          ? 'bg-white text-black'
          : 'bg-white/10 text-white hover:bg-white/20'
      )
    "
    @click.stop="emit('click')"
  >
    <i
      :class="pinned ? 'icon-[lucide--pin]' : 'icon-[lucide--pin-off]'"
      class="size-3.5"
    />
  </button>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

defineProps<{ pinned: boolean; label: string }>()

const emit = defineEmits<{ click: [] }>()
</script>
