import type { Viewport } from 'pixi-viewport'
import type { Ref } from 'vue'
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClickDragGuard } from '@/composables/useClickDragGuard'
import type { SpriteHitTester } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import type { OverrideRecord } from '@/platform/moshpit/stores/moshpitOverrideStore'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

export interface SpriteDragOptions {
  containerEl: Ref<HTMLElement | null>
  viewportRef: Ref<Viewport | null>
  hitTestRef: Ref<SpriteHitTester | null>
}

export interface SpriteDragHandle {
  onPointerDown(e: PointerEvent): boolean
  readonly isDragging: Readonly<Ref<boolean>>
  undoLast(): void
  cancel(): void
}

const CLICK_DRAG_THRESHOLD_PX = 5
const TOAST_LIFE_MS = 5000

export function useMoshpitSpriteDrag(
  options: SpriteDragOptions
): SpriteDragHandle {
  const { containerEl, viewportRef, hitTestRef } = options
  const overrideStore = useMoshpitOverrideStore()
  const selectionStore = useMoshpitSelectionStore()
  const toastStore = useToastStore()
  const { t } = useI18n()
  const {
    recordStart,
    wasDragged,
    reset: resetGuard
  } = useClickDragGuard(CLICK_DRAG_THRESHOLD_PX)

  const isDragging = ref(false)

  let dragSet: string[] = []
  // Anchor = each hash's pre-drag world position. For unpinned hashes we fall
  // back to the pointer's world position at engage — treating the gesture as
  // a translate-the-group by pointer delta. This avoids a new SpriteHitTester
  // position API; a future task can expose sprite-center lookups for more
  // intuitive non-uniform multi-select anchoring.
  const anchorByHash = new Map<string, { x: number; y: number }>()
  const preDragSnapshots = new Map<string, OverrideRecord | undefined>()
  let startWorldX = 0
  let startWorldY = 0
  let hasExceededThreshold = false
  let isPaused = false

  let lastDragSet: string[] = []
  let lastSnapshots = new Map<string, OverrideRecord | undefined>()

  function pauseViewport() {
    if (isPaused) return
    const vp = viewportRef.value
    if (!vp) return
    vp.plugins.pause('drag')
    isPaused = true
  }

  function resumeViewport() {
    if (!isPaused) return
    const vp = viewportRef.value
    if (vp) vp.plugins.resume('drag')
    isPaused = false
  }

  function resolveDragSet(hitHash: string): string[] {
    const selected = selectionStore.selected
    if (selectionStore.size > 1 && selected.includes(hitHash)) {
      return [...selected]
    }
    return [hitHash]
  }

  function restoreFromSnapshots(
    snapshots: Map<string, OverrideRecord | undefined>
  ) {
    for (const [hash, snap] of snapshots) {
      if (snap?.pinnedWorldPos) overrideStore.setPin(hash, snap.pinnedWorldPos)
      else overrideStore.unpin(hash)
    }
  }

  function resetTransientState() {
    isDragging.value = false
    dragSet = []
    anchorByHash.clear()
    preDragSnapshots.clear()
    startWorldX = 0
    startWorldY = 0
    hasExceededThreshold = false
    resetGuard()
  }

  function detachListeners() {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerCancel)
    window.removeEventListener('keydown', onKeydown)
  }

  function attachListeners() {
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('keydown', onKeydown)
  }

  function onPointerDown(e: PointerEvent): boolean {
    if (e.button !== 0) return false
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return false

    const el = containerEl.value
    const vp = viewportRef.value
    const hitTester = hitTestRef.value
    if (!el || !vp || !hitTester) return false

    const bounds = el.getBoundingClientRect()
    const worldStart = vp.toWorld(
      e.clientX - bounds.left,
      e.clientY - bounds.top
    )
    const hitHash = hitTester.hitTestPoint(worldStart.x, worldStart.y)
    if (hitHash === null) return false

    // Safety reset: if a prior drag leaked (pointercancel missed etc.)
    if (isDragging.value || isPaused) cancel()

    dragSet = resolveDragSet(hitHash)
    anchorByHash.clear()
    preDragSnapshots.clear()
    for (const hash of dragSet) {
      const snap = overrideStore.get(hash)
      preDragSnapshots.set(hash, snap)
      // Anchor precedence: existing pin > current sprite world pos > pointer
      // world start. Using the sprite's current position for unpinned hashes
      // is what preserves relative offsets in multi-select drag.
      const anchor =
        snap?.pinnedWorldPos ?? hitTester.getSpriteWorldPos(hash) ?? worldStart
      anchorByHash.set(hash, { x: anchor.x, y: anchor.y })
    }

    startWorldX = worldStart.x
    startWorldY = worldStart.y
    hasExceededThreshold = false
    recordStart(e)
    attachListeners()
    pauseViewport()
    return true
  }

  function onPointerMove(e: PointerEvent) {
    if (!hasExceededThreshold) {
      if (!wasDragged(e)) return
      hasExceededThreshold = true
      isDragging.value = true
    }

    const el = containerEl.value
    const vp = viewportRef.value
    if (!el || !vp) return
    const bounds = el.getBoundingClientRect()
    const world = vp.toWorld(e.clientX - bounds.left, e.clientY - bounds.top)
    const dx = world.x - startWorldX
    const dy = world.y - startWorldY

    for (const hash of dragSet) {
      const anchor = anchorByHash.get(hash)
      if (!anchor) continue
      overrideStore.setPin(hash, { x: anchor.x + dx, y: anchor.y + dy })
    }
  }

  function onPointerUp(_e: PointerEvent) {
    detachListeners()

    if (!hasExceededThreshold) {
      // Click-sized release: we never wrote pins (deferred until threshold).
      resumeViewport()
      resetTransientState()
      return
    }

    const count = dragSet.length
    lastDragSet = [...dragSet]
    lastSnapshots = new Map(preDragSnapshots)

    toastStore.add({
      severity: 'info',
      summary:
        count === 1
          ? t('moshpit.pin.toastSingle')
          : t('moshpit.pin.toastMulti', { count }),
      detail: t('moshpit.pin.undoLabel'),
      life: TOAST_LIFE_MS
    })

    resumeViewport()
    resetTransientState()
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (!isDragging.value && !hasExceededThreshold && !isPaused) return
    detachListeners()
    restoreFromSnapshots(preDragSnapshots)
    resumeViewport()
    resetTransientState()
    e.preventDefault()
  }

  function onPointerCancel(_e: PointerEvent) {
    detachListeners()
    restoreFromSnapshots(preDragSnapshots)
    resumeViewport()
    resetTransientState()
  }

  function cancel() {
    detachListeners()
    resumeViewport()
    resetTransientState()
  }

  function undoLast() {
    if (lastDragSet.length === 0) return
    restoreFromSnapshots(lastSnapshots)
    lastDragSet = []
    lastSnapshots = new Map()
  }

  onBeforeUnmount(() => {
    cancel()
  })

  return {
    onPointerDown,
    isDragging,
    undoLast,
    cancel
  }
}
