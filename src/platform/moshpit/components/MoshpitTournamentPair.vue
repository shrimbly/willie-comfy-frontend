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

// Divider position IS the AB boundary. A fills the background; B is clipped
// so it only paints right of the divider. Dragging the divider right reveals
// more A; dragging left reveals more B.
const clipStyleForB = computed(() => ({
  clipPath: `inset(0 0 0 ${store.wipePosition * 100}%)`
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

      <!--
        Pick-pulse feedback. Re-keyed on every pickPulseId so the CSS
        animation restarts even when the same side is picked twice in a row.
        Pointer-events-none so it never blocks the divider or Asset clicks.
      -->
      <div
        v-if="store.lastPickedSide && store.pickPulseId > 0"
        :key="store.pickPulseId"
        class="moshpit-pick-pulse pointer-events-none absolute inset-y-0 z-10 w-1/2"
        :class="store.lastPickedSide === 'A' ? 'left-0' : 'right-0'"
        data-testid="moshpit-tournament-pair-pick-pulse"
      />
    </template>
  </div>
</template>

<style scoped>
/*
 * Pick pulse: a brief gradient flash on the winning side. z-10 keeps it
 * over the asset frames but beneath the divider (z-auto > 10 by DOM order).
 * The `from-` color side flips via `left-0` / `right-0` placement —
 * `-l` variant ensures the glow is anchored to the outer edge.
 */
.moshpit-pick-pulse {
  background: linear-gradient(
    to var(--pulse-direction, right),
    color-mix(in oklch, var(--success-background) 35%, transparent),
    color-mix(in oklch, var(--success-background) 0%, transparent)
  );
  animation: moshpit-pick-pulse 420ms ease-out forwards;
}
.moshpit-pick-pulse.right-0 {
  --pulse-direction: left;
}

@keyframes moshpit-pick-pulse {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
