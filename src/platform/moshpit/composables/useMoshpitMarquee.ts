import { useKeyModifier } from '@vueuse/core'
import type { CSSProperties, Ref } from 'vue'
import { computed, onBeforeUnmount, ref } from 'vue'

import { useClickDragGuard } from '@/composables/useClickDragGuard'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'

export interface MarqueeRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface UseMoshpitMarqueeOptions {
  containerEl: Ref<HTMLElement | null>
  /** Given a screen-space rect (relative to container), return asset IDs that intersect it. */
  hitTest: (rect: MarqueeRect) => readonly string[]
}

export function useMoshpitMarquee(options: UseMoshpitMarqueeOptions) {
  const { containerEl, hitTest } = options
  const selection = useMoshpitSelectionStore()
  const { recordStart, wasDragged, reset } = useClickDragGuard(5)

  const shiftKey = useKeyModifier('Shift')
  const ctrlKey = useKeyModifier('Control')
  const metaKey = useKeyModifier('Meta')

  const isDragging = ref(false)
  const rect = ref<MarqueeRect | null>(null)
  let startX = 0
  let startY = 0
  let preDragSelection: Set<string> = new Set()

  const overlayStyle = computed<CSSProperties>(() => {
    if (!rect.value) return { display: 'none' }
    const r = rect.value
    return {
      position: 'absolute',
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.right - r.left}px`,
      height: `${r.bottom - r.top}px`,
      pointerEvents: 'none'
    }
  })

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    // Ignore clicks on interactive children (assets, later phases)
    if (
      e.target instanceof HTMLElement &&
      e.target.closest('[data-moshpit-asset]')
    )
      return
    // Safety reset: if a prior drag never received its pointerup (pointercancel,
    // synthesized events, capture hand-off), discard in-flight state before starting fresh.
    if (isDragging.value || rect.value) cancel()

    const el = containerEl.value
    if (!el) return
    const bounds = el.getBoundingClientRect()
    startX = e.clientX - bounds.left
    startY = e.clientY - bounds.top
    recordStart(e)
    preDragSelection = new Set(selection.selected)

    el.setPointerCapture(e.pointerId)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e: PointerEvent) {
    if (!wasDragged(e)) return
    isDragging.value = true

    const el = containerEl.value
    if (!el) return
    const bounds = el.getBoundingClientRect()
    const curX = e.clientX - bounds.left
    const curY = e.clientY - bounds.top

    rect.value = {
      left: Math.min(startX, curX),
      top: Math.min(startY, curY),
      right: Math.max(startX, curX),
      bottom: Math.max(startY, curY)
    }
  }

  function onPointerUp(e: PointerEvent) {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    const el = containerEl.value
    if (el) el.releasePointerCapture(e.pointerId)

    const wasDrag = isDragging.value
    if (wasDrag && rect.value) {
      const hitIds = new Set(hitTest(rect.value))
      const isShift = shiftKey.value
      const isCmdCtrl = ctrlKey.value || metaKey.value
      if (isCmdCtrl) {
        // Symmetric toggle: items in pre-drag that are hit get removed,
        // items not in pre-drag that are hit get added
        const next: string[] = []
        for (const id of preDragSelection) if (!hitIds.has(id)) next.push(id)
        for (const id of hitIds) if (!preDragSelection.has(id)) next.push(id)
        selection.setSelection(next)
      } else if (isShift) {
        const next = new Set(preDragSelection)
        for (const id of hitIds) next.add(id)
        selection.setSelection([...next])
      } else {
        selection.setSelection([...hitIds])
      }
    }

    isDragging.value = false
    rect.value = null
    reset()
  }

  function cancel() {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    isDragging.value = false
    rect.value = null
    reset()
  }

  onBeforeUnmount(() => {
    cancel()
  })

  return { isDragging, rect, overlayStyle, onPointerDown, cancel }
}
