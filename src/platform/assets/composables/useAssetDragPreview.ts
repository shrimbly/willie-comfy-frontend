import { ref, shallowRef } from 'vue'

import { useAssetsStore } from '@/stores/assetsStore'
import { getFilenameDetails } from '@/utils/formatUtil'

import type { AssetItem } from '../schemas/assetSchema'
import { getAssetDisplayName } from '../utils/assetMetadataUtils'

const previewElement = shallowRef<HTMLElement | null>(null)
const thumbnails = ref<string[]>([])
const label = ref('')
const count = ref(0)
const contentVisible = ref(true)

type Translator = (key: string, params?: Record<string, unknown>) => string

export const ASSET_DRAG_MIME = 'application/x-comfy-asset-ids'

const CARD_WIDTH = 240
const CARD_HEIGHT = 56
const CURSOR_OFFSET_X = 30
const CURSOR_OFFSET_Y = 28
const MORPH_DURATION_MS = 280
const CONTENT_REVEAL_PROGRESS = 0.7
const OFFSCREEN_LEFT = -10000
const OFFSCREEN_TOP = -10000

let activeCleanup: (() => void) | null = null
let transparentDragImage: HTMLDivElement | null = null

function thumbnailFor(asset: AssetItem): string {
  return asset.thumbnail_url || asset.preview_url || ''
}

function getTransparentDragImage(): HTMLDivElement {
  if (!transparentDragImage || !document.body.contains(transparentDragImage)) {
    const el = document.createElement('div')
    el.style.position = 'fixed'
    el.style.top = '-10000px'
    el.style.left = '-10000px'
    el.style.width = '1px'
    el.style.height = '1px'
    el.style.opacity = '0'
    el.style.pointerEvents = 'none'
    document.body.appendChild(el)
    transparentDragImage = el
  }
  return transparentDragImage
}

interface SelectionBounds {
  left: number
  top: number
  width: number
  height: number
}

function computeSelectionBounds(): SelectionBounds | null {
  const cards = document.querySelectorAll<HTMLElement>('[data-selected="true"]')
  if (cards.length === 0) return null

  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const card of cards) {
    const rect = card.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    if (rect.left < left) left = rect.left
    if (rect.top < top) top = rect.top
    if (rect.right > right) right = rect.right
    if (rect.bottom > bottom) bottom = rect.bottom
  }
  const width = right - left
  const height = bottom - top
  if (width <= 0 || height <= 0) return null
  return { left, top, width, height }
}

function resetPreviewStyles(el: HTMLElement): void {
  el.style.left = `${OFFSCREEN_LEFT}px`
  el.style.top = `${OFFSCREEN_TOP}px`
  el.style.transform = 'none'
  el.style.opacity = ''
  el.style.transformOrigin = ''
  el.style.zIndex = ''
  el.style.position = ''
}

function easeOutCubic(t: number): number {
  const inv = 1 - t
  return 1 - inv * inv * inv
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function useAssetDragPreview() {
  function setPreviewElement(el: HTMLElement | null) {
    previewElement.value = el
  }

  function configure(
    ids: string[],
    primaryAsset: AssetItem,
    t: Translator
  ): void {
    const assetsStore = useAssetsStore()
    const allAssets = [...assetsStore.historyAssets, ...assetsStore.inputAssets]
    const byId = new Map(allAssets.map((asset) => [asset.id, asset]))

    const ordered: AssetItem[] = [primaryAsset]
    for (const id of ids) {
      if (id === primaryAsset.id) continue
      const found = byId.get(id)
      if (found) ordered.push(found)
    }

    const thumbs = ordered.map(thumbnailFor).filter(Boolean)
    thumbnails.value = thumbs.length > 0 ? thumbs : [thumbnailFor(primaryAsset)]
    count.value = ids.length
    label.value =
      ids.length === 1
        ? getFilenameDetails(getAssetDisplayName(primaryAsset)).filename
        : t('mediaAsset.dragPreview.itemsLabel', { count: ids.length })
  }

  function startDrag(event: DragEvent): void {
    if (!event.dataTransfer) return
    const candidate = previewElement.value
    if (!candidate) return
    const el: HTMLElement = candidate

    activeCleanup?.()

    event.dataTransfer.setDragImage(getTransparentDragImage(), 0, 0)

    const startCursorX = event.clientX
    const startCursorY = event.clientY
    let lastCursorX = startCursorX
    let lastCursorY = startCursorY

    el.style.position = 'fixed'
    el.style.transformOrigin = '0 0'
    el.style.zIndex = '9999'

    const bounds = computeSelectionBounds()
    let phase: 'morph' | 'follow' = 'follow'
    let rafId = 0
    contentVisible.value = true

    function commitFollow() {
      phase = 'follow'
      el.style.transform = 'none'
      el.style.opacity = '1'
      el.style.left = `${lastCursorX - CURSOR_OFFSET_X}px`
      el.style.top = `${lastCursorY - CURSOR_OFFSET_Y}px`
    }

    if (bounds) {
      phase = 'morph'
      contentVisible.value = false
      el.style.left = `${bounds.left}px`
      el.style.top = `${bounds.top}px`
      el.style.transform = `translate(0px, 0px) scale(${bounds.width / CARD_WIDTH}, ${bounds.height / CARD_HEIGHT})`
      el.style.opacity = '0.5'

      const startTime = performance.now()
      const initialScaleX = bounds.width / CARD_WIDTH
      const initialScaleY = bounds.height / CARD_HEIGHT

      function tick(now: number) {
        const elapsed = now - startTime
        const t = Math.min(1, elapsed / MORPH_DURATION_MS)
        const eased = easeOutCubic(t)

        const targetLeft = lastCursorX - CURSOR_OFFSET_X
        const targetTop = lastCursorY - CURSOR_OFFSET_Y
        const tx = lerp(0, targetLeft - bounds!.left, eased)
        const ty = lerp(0, targetTop - bounds!.top, eased)
        const sx = lerp(initialScaleX, 1, eased)
        const sy = lerp(initialScaleY, 1, eased)

        el.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`
        el.style.opacity = lerp(0.5, 1, eased).toString()

        if (!contentVisible.value && t >= CONTENT_REVEAL_PROGRESS) {
          contentVisible.value = true
        }

        if (t < 1) {
          rafId = requestAnimationFrame(tick)
        } else {
          rafId = 0
          commitFollow()
        }
      }
      rafId = requestAnimationFrame(tick)
    } else {
      el.style.left = `${startCursorX - CURSOR_OFFSET_X}px`
      el.style.top = `${startCursorY - CURSOR_OFFSET_Y}px`
      el.style.transform = 'none'
      el.style.opacity = '1'
      contentVisible.value = true
    }

    function onDragOver(e: DragEvent) {
      lastCursorX = e.clientX
      lastCursorY = e.clientY
      if (phase === 'follow') {
        el.style.left = `${e.clientX - CURSOR_OFFSET_X}px`
        el.style.top = `${e.clientY - CURSOR_OFFSET_Y}px`
      }
    }

    function cleanup() {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragend', cleanup)
      document.removeEventListener('drop', cleanup)
      resetPreviewStyles(el)
      contentVisible.value = true
      activeCleanup = null
    }

    activeCleanup = cleanup

    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragend', cleanup)
    document.addEventListener('drop', cleanup)
  }

  return {
    thumbnails,
    label,
    count,
    contentVisible,
    setPreviewElement,
    configure,
    startDrag
  }
}
