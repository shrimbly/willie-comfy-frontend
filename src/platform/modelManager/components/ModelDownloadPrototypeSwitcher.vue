<template>
  <section
    v-if="flags.serverSideModelDownloads"
    class="pointer-events-auto absolute bottom-3 left-1/2 z-1300 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-lg border border-interface-stroke bg-interface-panel-surface p-2 shadow-interface"
    :aria-label="t('modelManager.prototype.trackingPlacement')"
  >
    <span class="shrink-0 text-xs font-medium text-muted-foreground">
      {{ t('modelManager.prototype.trackingPlacement') }}
    </span>
    <div class="flex min-w-0 items-center gap-1" role="group">
      <Button
        :variant="trackingPlacement === 'floating' ? 'secondary' : 'textonly'"
        size="md"
        :aria-pressed="trackingPlacement === 'floating'"
        @click="trackingPlacement = 'floating'"
      >
        <i class="icon-[lucide--picture-in-picture-2] size-4" />
        {{ t('modelManager.prototype.floating') }}
      </Button>
      <Button
        :variant="trackingPlacement === 'topbar' ? 'secondary' : 'textonly'"
        size="md"
        :aria-pressed="trackingPlacement === 'topbar'"
        @click="trackingPlacement = 'topbar'"
      >
        <i class="icon-[lucide--panel-top] size-4" />
        {{ t('modelManager.prototype.topbar') }}
      </Button>
      <Button
        :variant="trackingPlacement === 'sidebar' ? 'secondary' : 'textonly'"
        size="md"
        :aria-pressed="trackingPlacement === 'sidebar'"
        @click="trackingPlacement = 'sidebar'"
      >
        <i class="icon-[lucide--panel-left] size-4" />
        {{ t('modelManager.prototype.sidebar') }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

import { useModelDownloadUiStore } from '../stores/modelDownloadUiStore'

const { t } = useI18n()
const { flags } = useFeatureFlags()
const { trackingPlacement } = storeToRefs(useModelDownloadUiStore())
</script>
