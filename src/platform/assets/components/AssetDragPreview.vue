<template>
  <div
    ref="rootRef"
    class="pointer-events-none h-14 w-60 rounded-2xl border border-comfy-input bg-base-background shadow-lg"
  >
    <div
      :class="
        cn(
          'flex h-full items-center gap-3 px-3 transition-[opacity,transform] duration-300 ease-out',
          contentVisible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        )
      "
    >
      <div class="relative h-12 w-20 shrink-0">
        <template v-if="thumbnails.length === 1">
          <img
            :src="thumbnails[0]"
            alt=""
            class="absolute bottom-0 left-0 size-12 rounded-md object-cover"
          />
        </template>
        <template v-else>
          <img
            v-for="(thumb, index) in fannedThumbnails"
            :key="`${thumb}-${index}`"
            :src="thumb"
            alt=""
            :class="
              cn(
                'absolute bottom-0 left-0 size-12 origin-bottom-left rounded-md object-cover ring-2 ring-base-background',
                index === 0 && 'z-20',
                index === 1 && 'z-10 translate-x-1 -translate-y-1.5 rotate-6',
                index === 2 && 'z-0 translate-x-2 -translate-y-3 rotate-12'
              )
            "
          />
        </template>
      </div>
      <span class="min-w-0 flex-1 truncate text-sm text-base-foreground">
        {{ label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const {
  thumbnails,
  label,
  contentVisible = true
} = defineProps<{
  thumbnails: string[]
  label: string
  contentVisible?: boolean
}>()

const rootRef = ref<HTMLElement | null>(null)

const fannedThumbnails = computed(() => thumbnails.slice(0, 3))

defineExpose({ rootRef })
</script>
