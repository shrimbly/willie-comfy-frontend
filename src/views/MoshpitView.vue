<template>
  <div
    id="moshpit-canvas-container"
    ref="containerEl"
    data-testid="moshpit-canvas-container"
    tabindex="0"
    class="relative size-full overflow-hidden outline-none"
    @pointerdown="onContainerPointerDown"
    @keydown="onContainerKeydown"
    @contextmenu="onContextMenu"
  >
    <MoshpitCanvas v-if="containerEl" :container-el="containerEl" />
    <MoshpitClusterOverlay />
    <MoshpitEmptyGateOverlay />
    <MoshpitMarqueeOverlay
      :is-dragging="marquee.isDragging.value"
      :overlay-style="marquee.overlayStyle.value"
    />
    <MoshpitTournamentOverlay :resolve-full-res-url="resolveFullResUrl" />
    <MoshpitFloatingActionBar
      :resolve-full-res-url="resolveFullResUrl"
      @open-tag-popover="openTagPopover($event.hashes)"
      @open-folder-picker="openFolderPopover($event.hashes)"
    />
    <MoshpitSpriteContextMenu
      ref="contextMenuRef"
      @open-tag-popover="openTagPopover($event.hashes)"
      @open-folder-picker="openFolderPopover($event.hashes)"
    />
    <MoshpitTagInputPopover
      v-model:open="tagPopoverOpen"
      :hashes="popoverHashes"
    />
    <MoshpitFolderPickerPopover
      v-model:open="folderPopoverOpen"
      :hashes="popoverHashes"
    />
  </div>
</template>

<script setup lang="ts">
import type { Viewport } from 'pixi-viewport'
import { provide, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getAssetUrl } from '@/platform/assets/utils/assetUrlUtil'
import MoshpitCanvas from '@/platform/moshpit/components/MoshpitCanvas.vue'
import MoshpitClusterOverlay from '@/platform/moshpit/components/MoshpitClusterOverlay.vue'
import MoshpitEmptyGateOverlay from '@/platform/moshpit/components/MoshpitEmptyGateOverlay.vue'
import MoshpitFloatingActionBar from '@/platform/moshpit/components/MoshpitFloatingActionBar.vue'
import MoshpitFolderPickerPopover from '@/platform/moshpit/components/MoshpitFolderPickerPopover.vue'
import MoshpitMarqueeOverlay from '@/platform/moshpit/components/MoshpitMarqueeOverlay.vue'
import MoshpitSpriteContextMenu from '@/platform/moshpit/components/MoshpitSpriteContextMenu.vue'
import MoshpitTagInputPopover from '@/platform/moshpit/components/MoshpitTagInputPopover.vue'
import MoshpitTournamentOverlay from '@/platform/moshpit/components/MoshpitTournamentOverlay.vue'
import type { MarqueeRect } from '@/platform/moshpit/composables/useMoshpitMarquee'
import { useMoshpitMarquee } from '@/platform/moshpit/composables/useMoshpitMarquee'
import { useMoshpitSpriteDrag } from '@/platform/moshpit/composables/useMoshpitSpriteDrag'
import { useMoshpitSpriteResize } from '@/platform/moshpit/composables/useMoshpitSpriteResize'
import { useMoshpitCuration } from '@/platform/moshpit/composables/useMoshpitCuration'
import { useMoshpitCurationKeybindings } from '@/platform/moshpit/composables/useMoshpitCurationKeybindings'
import type { SpriteHitTester } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import {
  MOSHPIT_SPRITE_HITTEST_INJECTION_KEY,
  MOSHPIT_VIEWPORT_INJECTION_KEY
} from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useMoshpitSidebarStore } from '@/platform/moshpit/stores/moshpitSidebarStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAssetsStore } from '@/stores/assetsStore'

const CLICK_DRAG_THRESHOLD_PX = 5

defineOptions({ name: 'MoshpitView' })

const containerEl = ref<HTMLElement | null>(null)
const contextMenuRef = ref<InstanceType<
  typeof MoshpitSpriteContextMenu
> | null>(null)

const viewportRef = shallowRef<Viewport | null>(null)
provide(MOSHPIT_VIEWPORT_INJECTION_KEY, viewportRef)

const spriteHitTestRef = shallowRef<SpriteHitTester | null>(null)
provide(MOSHPIT_SPRITE_HITTEST_INJECTION_KEY, spriteHitTestRef)

const sidebarStore = useMoshpitSidebarStore()
const selectionStore = useMoshpitSelectionStore()
const tournamentStore = useMoshpitTournamentStore()
const metadataStore = useMoshpitMetadataStore()
const assetsStore = useAssetsStore()
const toastStore = useToastStore()
const filterStore = useMoshpitFilterStore()
const overrideStore = useMoshpitOverrideStore()
const { t } = useI18n()

watch(
  () => filterStore.activeGroupings,
  () => {
    overrideStore.clearAll()
  }
)

function screenRectToWorld(rect: MarqueeRect): MarqueeRect | null {
  const vp = viewportRef.value
  if (!vp) return null
  const topLeft = vp.toWorld(rect.left, rect.top)
  const bottomRight = vp.toWorld(rect.right, rect.bottom)
  return {
    left: Math.min(topLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, bottomRight.y),
    right: Math.max(topLeft.x, bottomRight.x),
    bottom: Math.max(topLeft.y, bottomRight.y)
  }
}

const marquee = useMoshpitMarquee({
  containerEl,
  hitTest: (screenRect) => {
    const world = screenRectToWorld(screenRect)
    const hitTester = spriteHitTestRef.value
    if (!world || !hitTester) return []
    return hitTester.hitTestRect(world)
  }
})

const spriteResize = useMoshpitSpriteResize({
  containerEl,
  viewportRef,
  hitTestRef: spriteHitTestRef
})

const spriteDrag = useMoshpitSpriteDrag({
  containerEl,
  viewportRef,
  hitTestRef: spriteHitTestRef
})

/**
 * Tournament full-res URL resolver. Looks up an asset by contentHash and
 * returns its `/view?filename=...` URL via getAssetUrl. OSS-path assets have
 * `asset_hash === null` — we bridge via `metadataStore.getHashForAssetId`
 * mirroring `useMoshpitAssetRegistry`.
 *
 * Returns `null` for hashes not resolvable; preload skips nulls gracefully.
 */
function resolveFullResUrl(hash: string): string | null {
  for (const asset of assetsStore.historyAssets) {
    const assetHash =
      asset.asset_hash ?? metadataStore.getHashForAssetId(asset.id) ?? null
    if (assetHash === hash) return getAssetUrl(asset)
  }
  return null
}

// Bind useMoshpitCuration at the top level so the module-singleton lastUndoable
// is initialised with resolveFullResUrl — this means context menu and keybindings
// all share the same resolver via the singleton.
useMoshpitCuration({ resolveFullResUrl })

const tagPopoverOpen = ref(false)
const folderPopoverOpen = ref(false)
const popoverHashes = ref<readonly string[]>([])

function openTagPopover(hashes?: readonly string[]): void {
  popoverHashes.value = hashes ?? [...selectionStore.selected]
  tagPopoverOpen.value = true
}

function openFolderPopover(hashes?: readonly string[]): void {
  popoverHashes.value = hashes ?? [...selectionStore.selected]
  folderPopoverOpen.value = true
}

useMoshpitCurationKeybindings({
  containerEl,
  openTagPopover: () => openTagPopover()
})

let clickDownX = 0
let clickDownY = 0
let clickPointerId: number | null = null

function onContainerPointerDown(e: PointerEvent) {
  containerEl.value?.focus()
  if (e.button !== 0) return
  sidebarStore.collapseOnFirstClick()
  // Resize handles take absolute precedence over drag-to-pin when the pointer
  // is on a corner handle. Resize engages only for single-element selections;
  // off-handle pointers fall through to the drag-to-pin path unchanged.
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    if (spriteResize.onPointerDown(e)) return
    if (spriteDrag.onPointerDown(e)) return
  }
  // Marquee only engages with Cmd (mac) or Ctrl (windows/linux) held — plain
  // left-drag stays with pixi-viewport for pan. Track click candidacy either
  // way so a plain left-click (no drag) can still hit-test for sprite select.
  if (e.ctrlKey || e.metaKey) marquee.onPointerDown(e)
  clickDownX = e.clientX
  clickDownY = e.clientY
  clickPointerId = e.pointerId
  document.addEventListener('pointerup', onContainerPointerUp, { once: true })
}

function onContainerPointerUp(e: PointerEvent) {
  if (clickPointerId !== null && e.pointerId !== clickPointerId) {
    document.addEventListener('pointerup', onContainerPointerUp, { once: true })
    return
  }
  clickPointerId = null
  const dx = Math.abs(e.clientX - clickDownX)
  const dy = Math.abs(e.clientY - clickDownY)
  // A drag (marquee) handles its own selection commit in the marquee composable.
  if (dx > CLICK_DRAG_THRESHOLD_PX || dy > CLICK_DRAG_THRESHOLD_PX) return

  const el = containerEl.value
  const vp = viewportRef.value
  const hitTester = spriteHitTestRef.value
  if (!el || !vp || !hitTester) return
  const bounds = el.getBoundingClientRect()
  const world = vp.toWorld(e.clientX - bounds.left, e.clientY - bounds.top)
  const hit = hitTester.hitTestPoint(world.x, world.y)

  const isToggle = e.ctrlKey || e.metaKey
  const isAdd = e.shiftKey
  if (hit === null) {
    if (!isToggle && !isAdd) selectionStore.clear()
    return
  }
  if (isToggle) selectionStore.toggle(hit)
  else if (isAdd) selectionStore.add(hit)
  else selectionStore.setSelection([hit])
}

function onContextMenu(e: MouseEvent) {
  const el = containerEl.value
  const vp = viewportRef.value
  const hitTester = spriteHitTestRef.value
  if (!el || !vp || !hitTester) return
  const bounds = el.getBoundingClientRect()
  const world = vp.toWorld(e.clientX - bounds.left, e.clientY - bounds.top)
  const hit = hitTester.hitTestPoint(world.x, world.y)
  if (hit === null) return
  e.preventDefault()
  contextMenuRef.value?.open(e.clientX, e.clientY, hit)
}

function onContainerKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter') return
  if (tournamentStore.isActive) return
  if (selectionStore.size < 2) {
    toastStore.add({
      severity: 'info',
      summary: t('moshpit.tournament.needTwoToastSummary'),
      detail: t('moshpit.tournament.needTwoToastDetail')
    })
    e.preventDefault()
    return
  }
  tournamentStore.enter(selectionStore.selected, resolveFullResUrl)
  e.preventDefault()
}
</script>
