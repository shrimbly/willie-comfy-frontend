<template>
  <ComfyImage
    v-if="item.isImage"
    :key="item.url"
    :src="item.url"
    :contain="false"
    :alt="item.filename"
    :class="cn('size-auto object-contain', $attrs.class as string)"
  />
  <ResultVideo v-else-if="item.isVideo" :result="item" />
  <ResultAudio v-else-if="item.isAudio" :result="item" />
</template>

<script setup lang="ts">
import ComfyImage from '@/components/common/ComfyImage.vue'
import type { ResultItemImpl } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

import ResultAudio from './ResultAudio.vue'
import ResultVideo from './ResultVideo.vue'

defineProps<{ item: ResultItemImpl }>()

defineOptions({ inheritAttrs: false })
</script>
