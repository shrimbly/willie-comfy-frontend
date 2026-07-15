<template>
  <section
    v-if="showTracker"
    class="pointer-events-auto absolute top-3 right-3 z-1200 flex max-h-[60vh] w-80 flex-col overflow-hidden rounded-lg border border-interface-stroke bg-interface-panel-surface shadow-interface"
    :aria-label="t('modelManager.title')"
    aria-live="polite"
  >
    <header
      class="flex items-center gap-2 border-b border-interface-stroke p-3"
    >
      <i class="icon-[lucide--download] size-4 shrink-0" />
      <div class="min-w-0 flex-1">
        <h2 class="m-0 text-sm font-semibold text-base-foreground">
          {{ t('modelManager.title') }}
        </h2>
        <p class="m-0 text-xs text-muted-foreground">
          <span v-if="activeDownloadCount">
            {{
              t('modelManager.prototype.activeDownloads', activeDownloadCount)
            }}
          </span>
          <span v-if="activeDownloadCount && failedDownloadCount"> · </span>
          <span v-if="failedDownloadCount">
            {{
              t(
                'modelManager.prototype.downloadsNeedAttention',
                failedDownloadCount
              )
            }}
          </span>
        </p>
      </div>
      <Button
        v-tooltip.left="t('modelManager.prototype.openDownloads')"
        variant="textonly"
        size="icon"
        :aria-label="t('modelManager.prototype.openDownloads')"
        @click="openDownloads"
      >
        <i class="icon-[lucide--panel-left-open] size-4" />
      </Button>
    </header>
    <div class="flex min-h-0 flex-col gap-2 overflow-y-auto p-3">
      <ModelDownloadRow
        v-for="download in trackedDownloads"
        :key="download.download_id"
        :download
        @open-auth="openAuth"
      />
    </div>
  </section>

  <DownloadAuthDialog v-model:open="authOpen" :focus-provider="focusProvider" />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import DownloadAuthDialog from './DownloadAuthDialog.vue'
import ModelDownloadRow from './ModelDownloadRow.vue'
import { useModelDownloadStore } from '../stores/modelDownloadStore'
import { useModelDownloadUiStore } from '../stores/modelDownloadUiStore'
import type { DownloadProvider, DownloadState, DownloadStatus } from '../types'

const TRACKED_STATES: ReadonlySet<DownloadState> = new Set([
  'queued',
  'active',
  'paused',
  'verifying',
  'failed'
])

const { t } = useI18n()
const { flags } = useFeatureFlags()
const sidebarTabStore = useSidebarTabStore()
const downloadStore = useModelDownloadStore()
const { downloadList } = storeToRefs(downloadStore)
const { trackingPlacement } = storeToRefs(useModelDownloadUiStore())
const { activeSidebarTabId } = storeToRefs(sidebarTabStore)
const authOpen = ref(false)
const focusProvider = ref<DownloadProvider>()

const trackedDownloads = computed(() =>
  Array.from(new Set(downloadList.value.map((download) => download.model_id)))
    .map((modelId) => downloadStore.findByModelId(modelId))
    .filter(isTrackedDownload)
    .sort((a, b) => b.updated_at - a.updated_at)
)
const activeDownloadCount = computed(
  () =>
    trackedDownloads.value.filter((download) => download.status !== 'failed')
      .length
)
const failedDownloadCount = computed(
  () =>
    trackedDownloads.value.filter((download) => download.status === 'failed')
      .length
)

const showTracker = computed(
  () =>
    flags.serverSideModelDownloads &&
    trackingPlacement.value === 'floating' &&
    trackedDownloads.value.length > 0 &&
    activeSidebarTabId.value !== 'model-manager'
)

function isTrackedDownload(
  download: DownloadStatus | undefined
): download is DownloadStatus {
  return download !== undefined && TRACKED_STATES.has(download.status)
}

function openDownloads() {
  sidebarTabStore.activeSidebarTabId = 'model-manager'
}

function openAuth(provider: DownloadProvider | undefined) {
  focusProvider.value = provider
  authOpen.value = true
}
</script>
