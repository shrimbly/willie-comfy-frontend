import type { Viewport } from 'pixi-viewport'
import type { Ref } from 'vue'
import { onBeforeUnmount, ref } from 'vue'

import type { SpriteHitTester } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'

export interface SpriteResizeOptions {
  containerEl: Ref<HTMLElement | null>
  viewportRef: Ref<Viewport | null>
  hitTestRef: Ref<SpriteHitTester | null>
}

export interface SpriteResizeHandle {
  onPointerDown(e: PointerEvent): boolean
  readonly isResizing: Readonly<Ref<boolean>>
}

const MIN_SCALE = 0.25
const MAX_SCALE = 5
const CLEAR_SCALE_EPSILON = 0.01

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function useMoshpitSpriteResize(
  options: SpriteResizeOptions
): SpriteResizeHandle {
  const { containerEl, viewportRef, hitTestRef } = options
  const overrideStore = useMoshpitOverrideStore()

  const isResizing = ref(false)

  let activeHash: string | null = null
  let startScale = 1
  let startDistance = 0
  let spriteCenter = { x: 0, y: 0 }
  let prevScaleSnapshot: number | undefined
  let isPaused = false

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

  function reset() {
    isResizing.value = false
    activeHash = null
    startScale = 1
    startDistance = 0
    spriteCenter = { x: 0, y: 0 }
    prevScaleSnapshot = undefined
  }

  function restorePreResize() {
    if (!activeHash) return
    if (prevScaleSnapshot === undefined) overrideStore.clearScale(activeHash)
    else overrideStore.setScale(activeHash, prevScaleSnapshot)
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
    const hit = hitTester.hitTestHandle(worldStart.x, worldStart.y)
    if (!hit) return false

    const center = hitTester.getSpriteWorldPos(hit.hash)
    if (!center) return false

    const dx = worldStart.x - center.x
    const dy = worldStart.y - center.y
    const dist = Math.hypot(dx, dy)
    // Degenerate: pointer is exactly at the sprite center (shouldn't happen —
    // corners are non-zero distance from center — but guard division-by-zero).
    if (dist === 0) return false

    activeHash = hit.hash
    spriteCenter = { x: center.x, y: center.y }
    startDistance = dist
    const prior = overrideStore.get(hit.hash)?.scale
    startScale = prior ?? 1
    prevScaleSnapshot = prior
    isResizing.value = true
    attachListeners()
    pauseViewport()
    return true
  }

  function onPointerMove(e: PointerEvent) {
    if (!activeHash) return
    const el = containerEl.value
    const vp = viewportRef.value
    if (!el || !vp) return
    const bounds = el.getBoundingClientRect()
    const world = vp.toWorld(e.clientX - bounds.left, e.clientY - bounds.top)
    const dx = world.x - spriteCenter.x
    const dy = world.y - spriteCenter.y
    const dist = Math.hypot(dx, dy)
    const raw = startScale * (dist / startDistance)
    const next = clamp(raw, MIN_SCALE, MAX_SCALE)
    overrideStore.setScale(activeHash, next)
  }

  function onPointerUp(_e: PointerEvent) {
    detachListeners()
    if (activeHash) {
      const final = overrideStore.get(activeHash)?.scale
      if (final !== undefined && Math.abs(final - 1) < CLEAR_SCALE_EPSILON) {
        overrideStore.clearScale(activeHash)
      }
    }
    resumeViewport()
    reset()
  }

  function onPointerCancel(_e: PointerEvent) {
    detachListeners()
    restorePreResize()
    resumeViewport()
    reset()
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (!isResizing.value && !isPaused) return
    detachListeners()
    restorePreResize()
    resumeViewport()
    reset()
    e.preventDefault()
  }

  onBeforeUnmount(() => {
    detachListeners()
    resumeViewport()
    reset()
  })

  return { onPointerDown, isResizing }
}
