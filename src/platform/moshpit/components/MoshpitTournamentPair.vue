<!--
  Phase 5 Plan 04 — MoshpitTournamentPair.

  Reads currentPair / displayMode / flipShowsB / wipePosition from the
  tournament store and renders one of three layouts (D-15/D-16/D-17).
  Delegates single-asset rendering to MoshpitTournamentAssetFrame.

  The parent (overlay, Plan 06) provides a resolveFullResUrl prop that maps
  an assetHash to its full-resolution URL (typically via getAssetUrl). This
  keeps the component decoupled from the assets store.

  Mode switching preserves store state (D-18) — this component is stateless
  beyond local pointer-drag tracking for the overlap divider.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'

import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'

import MoshpitTournamentAssetFrame from './MoshpitTournamentAssetFrame.vue'

defineOptions({ name: 'MoshpitTournamentPair' })

const { resolveFullResUrl } = defineProps<{
  resolveFullResUrl: (hash: string) => string | null
}>()

const store = useMoshpitTournamentStore()

const rootEl = ref<HTMLElement | null>(null)
const isDraggingDivider = ref(false)

function urlFor(hash: string): string | null {
  return resolveFullResUrl(hash)
}

function onDividerPointerDown(e: PointerEvent): void {
  isDraggingDivider.value = true
  const target = e.currentTarget as Element | null
  target?.setPointerCapture?.(e.pointerId)
}

function onDividerPointerMove(e: PointerEvent): void {
  if (!isDraggingDivider.value || !rootEl.value) return
  const rect = rootEl.value.getBoundingClientRect()
  if (rect.width <= 0) return
  store.setWipePosition((e.clientX - rect.left) / rect.width)
}

function onDividerPointerUp(e: PointerEvent): void {
  isDraggingDivider.value = false
  const target = e.currentTarget as Element | null
  target?.releasePointerCapture?.(e.pointerId)
}

const clipStyleForB = computed(() => ({
  clipPath: `inset(0 ${store.wipePosition * 100}% 0 0)`
}))

const dividerStyle = computed(() => ({
  left: `${store.wipePosition * 100}%`
}))

const flipHash = computed(() =>
  store.currentPair
    ? store.flipShowsB
      ? store.currentPair.assetHashB
      : store.currentPair.assetHashA
    : null
)
</script>

<template>
  <div
    ref="rootEl"
    class="relative flex size-full items-stretch bg-base-background"
    data-testid="moshpit-tournament-pair-root"
  >
    <template v-if="store.currentPair">
      <template v-if="store.displayMode === 'sideBySide'">
        <div class="h-full w-1/2" data-testid="moshpit-tournament-pair-half">
          <MoshpitTournamentAssetFrame
            :hash="store.currentPair.assetHashA"
            :full-res-url="urlFor(store.currentPair.assetHashA)"
            label="A"
            :highlight="!store.flipShowsB"
          />
        </div>
        <div class="h-full w-1/2" data-testid="moshpit-tournament-pair-half">
          <MoshpitTournamentAssetFrame
            :hash="store.currentPair.assetHashB"
            :full-res-url="urlFor(store.currentPair.assetHashB)"
            label="B"
            :highlight="store.flipShowsB"
          />
        </div>
      </template>

      <template v-else-if="store.displayMode === 'overlap'">
        <div class="absolute inset-0">
          <MoshpitTournamentAssetFrame
            :hash="store.currentPair.assetHashA"
            :full-res-url="urlFor(store.currentPair.assetHashA)"
            label="A"
          />
        </div>
        <div
          class="absolute inset-0"
          :style="clipStyleForB"
          data-testid="moshpit-tournament-pair-clipped"
        >
          <MoshpitTournamentAssetFrame
            :hash="store.currentPair.assetHashB"
            :full-res-url="urlFor(store.currentPair.assetHashB)"
            label="B"
          />
        </div>
        <div
          class="pointer-events-auto absolute inset-y-0 w-0.5 cursor-ew-resize bg-base-foreground"
          :style="dividerStyle"
          data-testid="moshpit-tournament-pair-divider"
          @pointerdown="onDividerPointerDown"
          @pointermove="onDividerPointerMove"
          @pointerup="onDividerPointerUp"
          @pointercancel="onDividerPointerUp"
        >
          <div
            class="absolute top-1/2 left-1/2 size-6 -translate-1/2 rounded-full border border-base-foreground bg-base-background"
          />
        </div>
      </template>

      <template v-else-if="store.displayMode === 'flip' && flipHash">
        <MoshpitTournamentAssetFrame
          :hash="flipHash"
          :full-res-url="urlFor(flipHash)"
          :label="store.flipShowsB ? 'B' : 'A'"
        />
      </template>
    </template>
  </div>
</template>
