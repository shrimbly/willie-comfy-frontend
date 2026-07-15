<template>
  <Button
    v-if="showButton"
    v-tooltip.bottom="t('modelManager.prototype.openDownloads')"
    variant="muted-textonly"
    size="icon"
    class="relative shrink-0 text-base-foreground"
    :aria-label="indicatorLabel"
    :aria-pressed="activeSidebarTabId === 'model-manager'"
    @click="sidebarTabStore.toggleSidebarTab('model-manager')"
  >
    <i class="icon-[lucide--download] size-4" />
    <StatusBadge
      v-if="indicatorDownloadCount > 0"
      :label="indicatorDownloadCount"
      :severity="failedDownloadCount > 0 ? 'danger' : 'default'"
      class="pointer-events-none absolute -top-0.5 -right-0.5"
    />
  </Button>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import { useModelDownloadStore } from '../stores/modelDownloadStore'
import { useModelDownloadUiStore } from '../stores/modelDownloadUiStore'

const { t } = useI18n()
const { flags } = useFeatureFlags()
const sidebarTabStore = useSidebarTabStore()
const { activeSidebarTabId } = storeToRefs(sidebarTabStore)
const { activeDownloadCount, failedDownloadCount, indicatorDownloadCount } =
  storeToRefs(useModelDownloadStore())
const { trackingPlacement } = storeToRefs(useModelDownloadUiStore())

const showButton = computed(
  () => flags.serverSideModelDownloads && trackingPlacement.value === 'topbar'
)
const indicatorLabel = computed(() =>
  [
    t('modelManager.prototype.openDownloads'),
    activeDownloadCount.value > 0
      ? t('modelManager.prototype.activeDownloads', activeDownloadCount.value)
      : '',
    failedDownloadCount.value > 0
      ? t(
          'modelManager.prototype.downloadsNeedAttention',
          failedDownloadCount.value
        )
      : ''
  ]
    .filter(Boolean)
    .join('. ')
)
</script>
