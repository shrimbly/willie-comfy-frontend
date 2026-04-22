<!--
  Phase 5 Plan 04 — MoshpitTournamentAssetFrame (D-24).

  Single-asset display primitive. Renders the cached WebP thumbnail first
  (via moshpitThumbStore.getUrl per Pitfall 2) and crossfades
  to the full-resolution image when a detached Image() preloader reports
  `onload`. Staying on the thumb is the graceful fallback when full-res
  fails, is missing, or has not yet finished loading.

  i18n keys referenced: moshpit.tournament.assetAlt (wired in Plan 06).
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'
import { cn } from '@/utils/tailwindUtil'

defineOptions({ name: 'MoshpitTournamentAssetFrame' })

const {
  hash,
  fullResUrl,
  label,
  highlight = false
} = defineProps<{
  hash: string
  fullResUrl: string | null
  label?: 'A' | 'B'
  highlight?: boolean
}>()

const { t } = useI18n()
const thumbStore = useMoshpitThumbStore()

const thumbUrl = computed<string | undefined>(() => thumbStore.getUrl(hash))
const isFullResLoaded = ref(false)

// Preload full-res into a detached Image; swap `src` only on success. When
// the URL changes we reset the loaded flag so the UI falls back to the thumb
// until the new preloader resolves.
watch(
  () => fullResUrl,
  (url) => {
    isFullResLoaded.value = false
    if (!url) return
    const preloader = new Image()
    preloader.onload = () => {
      if (preloader.src === url) {
        isFullResLoaded.value = true
      }
    }
    preloader.onerror = () => {
      /* stay on thumb */
    }
    preloader.src = url
  },
  { immediate: true }
)

const shownSrc = computed<string | undefined>(() =>
  isFullResLoaded.value && fullResUrl ? fullResUrl : thumbUrl.value
)

const altText = computed(() => t('moshpit.tournament.assetAlt'))
</script>

<template>
  <div
    :class="
      cn(
        'relative flex size-full items-center justify-center overflow-hidden bg-base-background transition-all duration-300 ease-out',
        highlight && 'ring-2 ring-(--focus-ring)'
      )
    "
    data-testid="moshpit-tournament-asset-frame"
  >
    <img
      v-if="shownSrc"
      :src="shownSrc"
      :alt="altText"
      :class="
        cn(
          'max-h-full max-w-full object-contain transition-opacity duration-300 ease-out',
          isFullResLoaded ? 'opacity-100' : 'opacity-95'
        )
      "
      draggable="false"
    />
    <div
      v-if="label"
      class="absolute top-2 left-2 rounded-sm border border-border-subtle bg-secondary-background px-2 py-1 text-xs font-medium text-base-foreground shadow-sm"
      data-testid="moshpit-tournament-asset-label"
    >
      {{ label }}
    </div>
  </div>
</template>
