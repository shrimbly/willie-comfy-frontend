import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface ViewportBbox {
  x: number
  y: number
  width: number
  height: number
}

const MIN_ZOOM = 0.01
const MAX_ZOOM = 50

export const useMoshpitViewportStore = defineStore('moshpitViewport', () => {
  const panX = ref(0)
  const panY = ref(0)
  const zoom = ref(1)
  const screenWidth = ref(0)
  const screenHeight = ref(0)

  const pendingFitView = ref(false)
  const pendingZoomTarget = ref<ViewportBbox | null>(null)

  const transform = computed(() => ({
    panX: panX.value,
    panY: panY.value,
    zoom: zoom.value
  }))

  function setPan(x: number, y: number) {
    panX.value = x
    panY.value = y
  }

  function setZoom(z: number) {
    zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
  }

  function setScreenSize(w: number, h: number) {
    screenWidth.value = w
    screenHeight.value = h
  }

  function requestFitView() {
    pendingFitView.value = true
  }

  function consumeFitView(): boolean {
    if (!pendingFitView.value) return false
    pendingFitView.value = false
    return true
  }

  function requestZoomToSelection(bbox: ViewportBbox) {
    pendingZoomTarget.value = bbox
  }

  function consumeZoomToSelection(): ViewportBbox | null {
    const target = pendingZoomTarget.value
    pendingZoomTarget.value = null
    return target
  }

  return {
    panX,
    panY,
    zoom,
    screenWidth,
    screenHeight,
    transform,
    setPan,
    setZoom,
    setScreenSize,
    requestFitView,
    consumeFitView,
    requestZoomToSelection,
    consumeZoomToSelection
  }
})
