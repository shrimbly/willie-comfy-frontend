import type { CSSProperties, Ref } from 'vue'

import { useKeyModifier } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useClickDragGuard } from '@/composables/useClickDragGuard'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { useAssetSelectionStore } from './useAssetSelectionStore'

type Rect = { left: number; top: number; right: number; bottom: number }

export type GridLayout = {
  cols: number
  itemWidth: number
  itemHeight: number
  headerHeight: number
  gap: number
  padLeft: number
}

export function computeIntersectedIndices(
  rect: Rect,
  layout: GridLayout,
  totalItems: number
): number[] {
  if (totalItems === 0 || layout.cols === 0) return []

  const { cols, itemWidth, itemHeight, headerHeight, gap, padLeft } = layout
  const cellW = itemWidth + gap
  const cellH = itemHeight + gap

  const startCol = Math.max(0, Math.floor((rect.left - padLeft) / cellW))
  const endCol = Math.min(
    cols - 1,
    Math.floor((rect.right - padLeft - 1) / cellW)
  )
  if (startCol > endCol) return []

  const gridTop = rect.top - headerHeight
  const gridBottom = rect.bottom - headerHeight
  const startRow = Math.max(0, Math.floor(gridTop / cellH))
  const endRow = Math.floor((gridBottom - 1) / cellH)
  if (startRow > endRow) return []

  const indices: number[] = []
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const idx = row * cols + col
      if (idx >= totalItems) break
      // Check actual cell overlap (exclude gap-only intersections)
      const cellLeft = padLeft + col * cellW
      const cellRight = cellLeft + itemWidth
      const cellTop = headerHeight + row * cellH
      const cellBottom = cellTop + itemHeight
      if (
        rect.left < cellRight &&
        rect.right > cellLeft &&
        rect.top < cellBottom &&
        rect.bottom > cellTop
      ) {
        indices.push(idx)
      }
    }
  }
  return indices
}

export function useMarqueeSelection(options: {
  containerEl: Ref<HTMLElement | null>
  allAssets: Ref<AssetItem[]>
  cols: Ref<number>
  itemWidth: Ref<number>
  itemHeight: Ref<number>
  startIndex: Ref<number>
  gap: number
  padLeft: number
}) {
  const {
    containerEl,
    allAssets,
    cols,
    itemWidth,
    itemHeight,
    startIndex,
    gap,
    padLeft
  } = options

  const store = useAssetSelectionStore()
  const { recordStart, wasDragged, reset } = useClickDragGuard(5)

  const shiftKey = useKeyModifier('Shift')
  const ctrlKey = useKeyModifier('Control')
  const metaKey = useKeyModifier('Meta')

  const isDragging = ref(false)
  const viewportRect = ref<Rect | null>(null)
  let startX = 0
  let startY = 0
  let startScrollTop = 0
  let preDragSelection: Set<string> = new Set()

  const marqueeStyle = computed<CSSProperties>(() => {
    if (!viewportRect.value) return { display: 'none' }
    const r = viewportRect.value
    return {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.right - r.left}px`,
      height: `${r.bottom - r.top}px`
    }
  })

  function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    return !!target.closest(
      '[data-virtual-grid-item], [data-virtual-grid-header]'
    )
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    if (isInteractiveTarget(e.target)) return

    startX = e.clientX
    startY = e.clientY
    startScrollTop = containerEl.value?.scrollTop ?? 0
    recordStart(e)
    preDragSelection = new Set(store.selectedAssetIds)

    const el = containerEl.value
    if (el) el.setPointerCapture(e.pointerId)

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e: PointerEvent) {
    if (!wasDragged(e)) return
    isDragging.value = true

    const el = containerEl.value
    if (!el) return

    const scrollDelta = el.scrollTop - startScrollTop
    const adjustedStartY = startY - scrollDelta

    viewportRect.value = {
      left: Math.min(startX, e.clientX),
      top: Math.min(adjustedStartY, e.clientY),
      right: Math.max(startX, e.clientX),
      bottom: Math.max(adjustedStartY, e.clientY)
    }

    const gridEl = el.querySelector('[data-virtual-grid-content]')
    if (!gridEl) return
    const gridRect = gridEl.getBoundingClientRect()

    const gridRelRect: Rect = {
      left: Math.min(startX, e.clientX) - gridRect.left,
      top: Math.min(adjustedStartY, e.clientY) - gridRect.top,
      right: Math.max(startX, e.clientX) - gridRect.left,
      bottom: Math.max(adjustedStartY, e.clientY) - gridRect.top
    }

    const layout: GridLayout = {
      cols: cols.value,
      itemWidth: itemWidth.value,
      itemHeight: itemHeight.value,
      headerHeight: 0,
      gap,
      padLeft
    }

    const visibleCount = allAssets.value.length - startIndex.value
    const localIndices = computeIntersectedIndices(
      gridRelRect,
      layout,
      visibleCount
    )
    const hitIds = new Set(
      localIndices
        .map((i) => allAssets.value[i + startIndex.value]?.id)
        .filter(Boolean)
    )

    const isShift = shiftKey.value
    const isCmdCtrl = ctrlKey.value || metaKey.value

    if (isCmdCtrl) {
      // Symmetric toggle: items in pre-drag that are hit get removed,
      // items not in pre-drag that are hit get added
      const next: string[] = []
      for (const id of preDragSelection) {
        if (!hitIds.has(id)) next.push(id)
      }
      for (const id of hitIds) {
        if (!preDragSelection.has(id)) next.push(id)
      }
      store.setSelection(next)
    } else if (isShift) {
      const next = new Set(preDragSelection)
      for (const id of hitIds) next.add(id)
      store.setSelection([...next])
    } else {
      store.setSelection([...hitIds])
    }
  }

  function onPointerUp(e: PointerEvent) {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)

    const el = containerEl.value
    if (el) el.releasePointerCapture(e.pointerId)

    const wasDrag = isDragging.value
    isDragging.value = false
    viewportRect.value = null
    reset()

    if (wasDrag) {
      const container = el
      if (container) {
        const stopClick = (evt: Event) => {
          evt.stopPropagation()
          container.removeEventListener('click', stopClick, true)
        }
        container.addEventListener('click', stopClick, true)
      }
    }
  }

  return {
    isDragging,
    marqueeStyle,
    onPointerDown
  }
}
