<template>
  <template v-if="flags.serverSideModelDownloads && !isBuilderMode">
    <ModelDownloadPrototypeSwitcher />
    <ModelDownloadFloatingTracker />
  </template>
</template>

<script setup lang="ts">
import { watch } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

import ModelDownloadFloatingTracker from './ModelDownloadFloatingTracker.vue'
import ModelDownloadPrototypeSwitcher from './ModelDownloadPrototypeSwitcher.vue'
import { useModelDownloadStore } from '../stores/modelDownloadStore'

const { flags } = useFeatureFlags()
const { isBuilderMode } = useAppMode()
const downloadStore = useModelDownloadStore()

watch(
  () => flags.serverSideModelDownloads,
  (enabled) => {
    if (enabled) void downloadStore.hydrate().catch(() => {})
  },
  { immediate: true }
)
</script>
