<template>
  <Teleport to="body">
    <div
      v-if="galleryVisible"
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('g.gallery')"
      tabindex="-1"
      class="fixed inset-0 z-9999 flex items-center justify-center bg-black/90 outline-none"
      data-mask
      @mousedown="onMaskMouseDown"
      @mouseup="onMaskMouseUp"
      @keydown.stop="handleKeyDown"
    >
      <!-- Close Button -->
      <Button
        variant="secondary"
        size="icon-lg"
        class="absolute top-4 right-4 z-10 rounded-full"
        :aria-label="$t('g.close')"
        @click="close"
      >
        <i class="icon-[lucide--x] size-5" />
      </Button>

      <!-- Single-item mode -->
      <template v-if="!isCompareMode">
        <Button
          v-if="hasMultiple"
          variant="secondary"
          size="icon-lg"
          class="fixed top-1/2 left-4 z-10 -translate-y-1/2 rounded-full"
          :aria-label="$t('g.previous')"
          @click="navigateImage(-1)"
        >
          <i class="icon-[lucide--chevron-left] size-6" />
        </Button>

        <div class="flex max-h-full max-w-full items-center justify-center">
          <LightboxAssetView
            v-if="activeItem"
            :item="activeItem"
            class="max-h-[90vh] max-w-[90vw]"
          />
        </div>

        <Button
          v-if="hasMultiple"
          variant="secondary"
          size="icon-lg"
          class="fixed top-1/2 right-4 z-10 -translate-y-1/2 rounded-full"
          :aria-label="$t('g.next')"
          @click="navigateImage(1)"
        >
          <i class="icon-[lucide--chevron-right] size-6" />
        </Button>
      </template>

      <!-- Compare mode -->
      <template v-else>
        <!-- Combined header (wipe + flip modes) -->
        <div
          v-if="compareMode !== 'side-by-side'"
          class="pointer-events-none absolute top-4 left-1/2 z-10 flex max-w-[60vw] -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-2 py-1 text-sm text-white"
        >
          <PinBadge
            :pinned="pinnedSide === 'left'"
            :label="$t('mediaAsset.compare.pinSide')"
            @click="setPin('left')"
          />
          <span class="truncate">{{ leftItem?.filename }}</span>
          <span class="text-muted-foreground">{{
            $t('mediaAsset.compare.vs')
          }}</span>
          <span class="truncate">{{ rightItem?.filename }}</span>
          <PinBadge
            :pinned="pinnedSide === 'right'"
            :label="$t('mediaAsset.compare.pinSide')"
            @click="setPin('right')"
          />
          <span
            v-if="compareItems && compareItems.length > 2"
            class="ml-1 shrink-0 text-xs text-muted-foreground"
          >
            {{ cursorPositionLabel }}
          </span>
        </div>

        <!-- Layout container -->
        <div
          class="relative flex size-full items-center justify-center p-12"
          data-mask
        >
          <!-- Side-by-side -->
          <div
            v-if="compareMode === 'side-by-side'"
            class="flex size-full items-center justify-center gap-1"
          >
            <div
              class="flex h-full flex-1 flex-col items-center overflow-hidden"
            >
              <div
                class="pointer-events-none mb-2 flex max-w-full items-center gap-2 rounded-full bg-black/50 px-2 py-1 text-sm text-white"
              >
                <PinBadge
                  :pinned="pinnedSide === 'left'"
                  :label="$t('mediaAsset.compare.pinSide')"
                  @click="setPin('left')"
                />
                <span class="truncate">{{ leftItem?.filename }}</span>
              </div>
              <div
                class="flex flex-1 items-center justify-center overflow-hidden"
              >
                <LightboxAssetView
                  v-if="leftItem"
                  :item="leftItem"
                  class="max-h-full max-w-full"
                />
              </div>
            </div>
            <div class="h-3/4 w-px bg-white/20" />
            <div
              class="flex h-full flex-1 flex-col items-center overflow-hidden"
            >
              <div
                class="pointer-events-none mb-2 flex max-w-full items-center gap-2 rounded-full bg-black/50 px-2 py-1 text-sm text-white"
              >
                <span class="truncate">{{ rightItem?.filename }}</span>
                <PinBadge
                  :pinned="pinnedSide === 'right'"
                  :label="$t('mediaAsset.compare.pinSide')"
                  @click="setPin('right')"
                />
                <span
                  v-if="compareItems && compareItems.length > 2"
                  class="shrink-0 text-xs text-muted-foreground"
                >
                  {{ cursorPositionLabel }}
                </span>
              </div>
              <div
                class="flex flex-1 items-center justify-center overflow-hidden"
              >
                <LightboxAssetView
                  v-if="rightItem"
                  :item="rightItem"
                  class="max-h-full max-w-full"
                />
              </div>
            </div>
          </div>

          <!-- Wipe -->
          <div
            v-else-if="compareMode === 'wipe'"
            class="relative flex size-full items-center justify-center select-none"
            @pointerdown="onWipePointerDown"
          >
            <!-- Shared bounding box so both images occupy identical centered
                 regions — the wipe divider at N% of this box cleanly splits
                 them into visible left/right halves. -->
            <div
              ref="wipeBoxRef"
              class="relative size-full max-h-[80vh] max-w-[80vw]"
            >
              <img
                v-if="leftItem?.isImage"
                :src="leftItem.url"
                :alt="leftItem.filename"
                class="pointer-events-none absolute inset-0 size-full object-contain"
              />
              <video
                v-else-if="leftItem?.isVideo"
                :src="leftItem.url"
                muted
                loop
                autoplay
                playsinline
                class="pointer-events-none absolute inset-0 size-full object-contain"
              />
              <div
                class="absolute inset-0"
                :style="{
                  clipPath: `inset(0 0 0 ${wipePosition * 100}%)`
                }"
              >
                <img
                  v-if="rightItem?.isImage"
                  :src="rightItem.url"
                  :alt="rightItem.filename"
                  class="pointer-events-none absolute inset-0 size-full object-contain"
                />
                <video
                  v-else-if="rightItem?.isVideo"
                  :src="rightItem.url"
                  muted
                  loop
                  autoplay
                  playsinline
                  class="pointer-events-none absolute inset-0 size-full object-contain"
                />
              </div>
              <div
                class="pointer-events-none absolute inset-y-0 w-0.5 bg-white/80"
                :style="{ left: `${wipePosition * 100}%` }"
              >
                <div
                  class="pointer-events-auto absolute top-1/2 left-1/2 flex size-8 -translate-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-black shadow-lg"
                >
                  <i class="icon-[lucide--chevrons-left-right] size-4" />
                </div>
              </div>
            </div>
          </div>

          <!-- Flip -->
          <div
            v-else-if="compareMode === 'flip'"
            class="relative flex size-full items-center justify-center"
          >
            <LightboxAssetView
              v-if="flipItem"
              :item="flipItem"
              class="max-h-[80vh] max-w-[80vw]"
            />
            <div
              class="absolute top-4 left-4 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold text-white"
            >
              {{ flipShowingRight ? 'B' : 'A' }}
            </div>
          </div>
        </div>

        <!-- Mode cycler -->
        <div
          class="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/70 p-1 text-white"
        >
          <Button
            v-for="mode in compareModes"
            :key="mode"
            variant="secondary"
            size="sm"
            :class="
              cn(
                'rounded-full',
                compareMode === mode && 'bg-white text-black hover:bg-white/90'
              )
            "
            :aria-label="$t(`mediaAsset.compare.mode.${mode}`)"
            :aria-pressed="compareMode === mode"
            @click="setMode(mode)"
          >
            <i :class="modeIcon[mode]" class="size-4" />
            <span>{{ $t(`mediaAsset.compare.mode.${mode}`) }}</span>
          </Button>
        </div>

        <!-- Cursor navigation (3+ items) -->
        <template v-if="compareItems && compareItems.length > 2">
          <Button
            variant="secondary"
            size="icon-lg"
            class="fixed top-1/2 left-4 z-10 -translate-y-1/2 rounded-full"
            :aria-label="$t('g.previous')"
            @click="advanceCursor(-1)"
          >
            <i class="icon-[lucide--chevron-left] size-6" />
          </Button>
          <Button
            variant="secondary"
            size="icon-lg"
            class="fixed top-1/2 right-4 z-10 -translate-y-1/2 rounded-full"
            :aria-label="$t('g.next')"
            @click="advanceCursor(1)"
          >
            <i class="icon-[lucide--chevron-right] size-6" />
          </Button>
        </template>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { ResultItemImpl } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

import LightboxAssetView from './LightboxAssetView.vue'
import PinBadge from './PinBadge.vue'

type CompareMode = 'side-by-side' | 'wipe' | 'flip'

const compareModes: CompareMode[] = ['side-by-side', 'wipe', 'flip']

const modeIcon: Record<CompareMode, string> = {
  'side-by-side': 'icon-[lucide--columns-2]',
  wipe: 'icon-[lucide--chevrons-left-right]',
  flip: 'icon-[lucide--arrow-left-right]'
}

const emit = defineEmits<{
  (e: 'update:activeIndex', value: number): void
}>()

const props = defineProps<{
  allGalleryItems: ResultItemImpl[]
  activeIndex: number
  compareItems?: ResultItemImpl[]
}>()

const isCompareMode = computed(() => (props.compareItems?.length ?? 0) >= 2)

const galleryVisible = ref(false)
const dialogRef = ref<HTMLElement>()
let previouslyFocusedElement: HTMLElement | null = null

// Single-item flow
const hasMultiple = computed(() => props.allGalleryItems.length > 1)
const activeItem = computed(() => props.allGalleryItems[props.activeIndex])

// Compare-mode state
const compareMode = ref<CompareMode>('side-by-side')
const pinnedSide = ref<'left' | 'right'>('left')
const pinnedIndex = ref(0)
const cursorIndex = ref(1)
const wipePosition = ref(0.5)
const flipShowingRight = ref(false)

const compareItemsSafe = computed(() => props.compareItems ?? [])

const leftItem = computed<ResultItemImpl | undefined>(() =>
  pinnedSide.value === 'left'
    ? compareItemsSafe.value[pinnedIndex.value]
    : compareItemsSafe.value[cursorIndex.value]
)

const rightItem = computed<ResultItemImpl | undefined>(() =>
  pinnedSide.value === 'right'
    ? compareItemsSafe.value[pinnedIndex.value]
    : compareItemsSafe.value[cursorIndex.value]
)

const flipItem = computed<ResultItemImpl | undefined>(() =>
  flipShowingRight.value ? rightItem.value : leftItem.value
)

const cursorPositionLabel = computed(() => {
  const total = compareItemsSafe.value.length
  if (total <= 2) return ''
  return `${cursorIndex.value + 1} / ${total}`
})

// Reset compare state whenever the compare set changes identity or the dialog opens fresh
watch(
  () => [props.compareItems, props.activeIndex] as const,
  ([items, idx]) => {
    if (!items || items.length < 2 || idx === -1) return
    compareMode.value = 'side-by-side'
    pinnedSide.value = 'left'
    pinnedIndex.value = 0
    cursorIndex.value = items.length >= 2 ? 1 : 0
    wipePosition.value = 0.5
    flipShowingRight.value = false
  }
)

watch(
  () => props.activeIndex,
  (index) => {
    galleryVisible.value = index !== -1
    if (index !== -1) {
      previouslyFocusedElement = document.activeElement as HTMLElement | null
      void nextTick(() => dialogRef.value?.focus())
    }
  },
  { immediate: true }
)

function close() {
  galleryVisible.value = false
  emit('update:activeIndex', -1)
  previouslyFocusedElement?.focus()
  previouslyFocusedElement = null
}

function navigateImage(direction: number) {
  const newIndex =
    (props.activeIndex + direction + props.allGalleryItems.length) %
    props.allGalleryItems.length
  emit('update:activeIndex', newIndex)
}

function advanceCursor(direction: number) {
  const total = compareItemsSafe.value.length
  if (total <= 2) return
  let next = cursorIndex.value
  for (let i = 0; i < total; i++) {
    next = (next + direction + total) % total
    if (next !== pinnedIndex.value) break
  }
  cursorIndex.value = next
}

function setPin(side: 'left' | 'right') {
  if (pinnedSide.value === side) return
  const prevPin = pinnedIndex.value
  pinnedIndex.value = cursorIndex.value
  cursorIndex.value = prevPin
  pinnedSide.value = side
}

function togglePin() {
  setPin(pinnedSide.value === 'left' ? 'right' : 'left')
}

function setMode(mode: CompareMode) {
  compareMode.value = mode
}

function cycleMode() {
  const i = compareModes.indexOf(compareMode.value)
  compareMode.value = compareModes[(i + 1) % compareModes.length]
}

// Wipe drag
const wipeBoxRef = ref<HTMLElement>()
let wipeDragging = false

function onWipePointerDown(event: PointerEvent) {
  if (!wipeBoxRef.value) return
  wipeDragging = true
  ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
  updateWipePosition(event)
  window.addEventListener('pointermove', onWipePointerMove)
  window.addEventListener('pointerup', onWipePointerUp)
}

function onWipePointerMove(event: PointerEvent) {
  if (!wipeDragging) return
  updateWipePosition(event)
}

function onWipePointerUp() {
  wipeDragging = false
  window.removeEventListener('pointermove', onWipePointerMove)
  window.removeEventListener('pointerup', onWipePointerUp)
}

function updateWipePosition(event: PointerEvent) {
  const el = wipeBoxRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const ratio = (event.clientX - rect.left) / rect.width
  wipePosition.value = Math.max(0, Math.min(1, ratio))
}

let maskMouseDownTarget: EventTarget | null = null

function onMaskMouseDown(event: MouseEvent) {
  maskMouseDownTarget = event.target
}

function onMaskMouseUp(event: MouseEvent) {
  if (
    maskMouseDownTarget === event.target &&
    (event.target as HTMLElement)?.hasAttribute('data-mask')
  ) {
    close()
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (isCompareMode.value) {
    const compareActions: Record<string, () => void> = {
      '/': () => cycleMode(),
      p: () => togglePin(),
      P: () => togglePin(),
      ' ': () => {
        if (compareMode.value === 'flip') {
          flipShowingRight.value = !flipShowingRight.value
        }
      },
      ArrowLeft: () => advanceCursor(-1),
      ArrowRight: () => advanceCursor(1),
      Escape: () => close()
    }
    const action = compareActions[event.key]
    if (action) {
      event.preventDefault()
      action()
    }
    return
  }

  const actions: Record<string, () => void> = {
    ArrowLeft: () => navigateImage(-1),
    ArrowRight: () => navigateImage(1),
    Escape: () => close()
  }

  const action = actions[event.key]
  if (action) {
    event.preventDefault()
    action()
  }
}
</script>
