<template>
  <div class="asset-detail-panel">
    <div class="detail-section">
      <h4 class="detail-section-title">
        {{ $t('mediaAsset.details.assetDetails') }}
      </h4>
      <div class="detail-rows">
        <div class="detail-row">
          <span class="detail-label">
            {{ $t('mediaAsset.details.name') }}
          </span>
          <span class="detail-value" :title="displayName">
            {{ displayName }}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">
            {{ $t('mediaAsset.details.type') }}
          </span>
          <span class="detail-value">{{ fileType }}</span>
        </div>
        <div v-if="dimensions" class="detail-row">
          <span class="detail-label">
            {{ $t('mediaAsset.details.dimensions') }}
          </span>
          <span class="detail-value">{{ dimensions }}</span>
        </div>
        <div v-if="asset.size" class="detail-row">
          <span class="detail-label">
            {{ $t('mediaAsset.details.size') }}
          </span>
          <span class="detail-value">{{ formattedSize }}</span>
        </div>
      </div>
    </div>

    <div v-if="hasGenerationDetails" class="detail-section">
      <h4 class="detail-section-title">
        {{ $t('mediaAsset.details.generationDetails') }}
      </h4>
      <div class="detail-rows">
        <div v-if="formattedDuration" class="detail-row">
          <span class="detail-label">
            {{ $t('mediaAsset.details.duration') }}
          </span>
          <span class="detail-value">{{ formattedDuration }}</span>
        </div>
        <div v-if="promptMetadata?.model" class="detail-row">
          <span class="detail-label">
            {{ $t('mediaAsset.details.model') }}
          </span>
          <span class="detail-value" :title="promptMetadata.model">
            {{ promptMetadata.model }}
          </span>
        </div>
        <div v-if="promptMetadata?.lora" class="detail-row">
          <span class="detail-label">
            {{ $t('mediaAsset.details.lora') }}
          </span>
          <span class="detail-value" :title="promptMetadata.lora">
            {{ promptMetadata.lora }}
          </span>
        </div>
        <div v-if="promptMetadata?.vae" class="detail-row">
          <span class="detail-label">
            {{ $t('mediaAsset.details.vae') }}
          </span>
          <span class="detail-value" :title="promptMetadata.vae">
            {{ promptMetadata.vae }}
          </span>
        </div>
        <div v-if="promptMetadata?.steps != null" class="detail-row">
          <span class="detail-label">
            {{ $t('mediaAsset.details.steps') }}
          </span>
          <span class="detail-value">{{ promptMetadata.steps }}</span>
        </div>
        <div v-if="promptMetadata?.seed != null" class="detail-row">
          <span class="detail-label">
            {{ $t('mediaAsset.details.seed') }}
          </span>
          <span class="detail-value">{{ promptMetadata.seed }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetDisplayName } from '@/platform/assets/utils/assetMetadataUtils'
import type { PromptMetadata } from '@/platform/assets/utils/promptMetadataParser'
import { formatSize, getMediaTypeFromFilename } from '@/utils/formatUtil'

const { asset, promptMetadata = null } = defineProps<{
  asset: AssetItem
  promptMetadata?: PromptMetadata | null
}>()

const displayName = computed(() => getAssetDisplayName(asset))

const fileType = computed(() => {
  const mediaType = getMediaTypeFromFilename(asset.name)
  return mediaType.charAt(0).toUpperCase() + mediaType.slice(1)
})

const dimensions = ref<string | null>(null)

watch(
  () => asset.id,
  () => {
    dimensions.value = null
    const mediaType = getMediaTypeFromFilename(asset.name)
    if (mediaType === 'image' && asset.preview_url) {
      const img = new Image()
      img.onload = () => {
        dimensions.value = `${img.naturalWidth} \u00d7 ${img.naturalHeight}`
      }
      img.src = asset.preview_url
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  dimensions.value = null
})

const formattedSize = computed(() => formatSize(asset.size))

const executionTime = computed(
  () => asset.user_metadata?.executionTimeInSeconds as number | undefined
)

const formattedDuration = computed(() => {
  if (executionTime.value == null) return null
  return `${executionTime.value.toFixed(2)}s`
})

const hasGenerationDetails = computed(
  () =>
    formattedDuration.value !== null ||
    promptMetadata?.model !== null ||
    promptMetadata?.lora !== null ||
    promptMetadata?.vae !== null ||
    promptMetadata?.steps !== null ||
    promptMetadata?.seed !== null
)
</script>

<style scoped>
.asset-detail-panel {
  width: 200px;
  min-width: 200px;
  flex-shrink: 0;
  height: 100%;
  overflow-y: auto;
  border-left: 1px solid var(--p-content-border-color);
  background: var(--comfy-menu-bg);
}

.detail-section {
  padding: 0.75rem;
}

.detail-section + .detail-section {
  border-top: 1px solid var(--p-content-border-color);
}

.detail-section-title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin: 0 0 0.75rem;
}

.detail-rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.6875rem;
  line-height: 1.4;
}

.detail-label {
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.detail-value {
  color: var(--p-text-color);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
</style>
