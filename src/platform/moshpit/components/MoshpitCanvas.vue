<template>
  <div ref="pixiHostRef" class="absolute inset-0 size-full" />
</template>

<script setup lang="ts">
import { Application } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useMoshpitCanvasInput } from '@/platform/moshpit/composables/useMoshpitCanvasInput'
import { useMoshpitViewportStore } from '@/platform/moshpit/stores/moshpitViewportStore'

defineOptions({ name: 'MoshpitCanvas' })

const { containerEl } = defineProps<{
  containerEl: HTMLElement
}>()

const pixiHostRef = ref<HTMLElement | null>(null)
const viewportStore = useMoshpitViewportStore()

let app: Application | null = null
let viewport: Viewport | null = null
let rafHandle: number | null = null

const WORLD_SIZE = 10_000

onMounted(async () => {
  const host = pixiHostRef.value
  if (!host) return

  app = new Application()
  await app.init({
    resizeTo: host,
    background: 0x111111,
    antialias: false,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1
  })
  host.appendChild(app.canvas)

  viewport = new Viewport({
    screenWidth: host.clientWidth,
    screenHeight: host.clientHeight,
    worldWidth: WORLD_SIZE,
    worldHeight: WORLD_SIZE,
    events: app.renderer.events // REQUIRED for pixi.js v8 (Pitfall 3)
  })
  app.stage.addChild(viewport)
  viewport
    .drag({ mouseButtons: 'middle' })
    .pinch()
    .wheel({ smooth: 3 })
    .decelerate()

  useMoshpitCanvasInput(viewport, containerEl)

  viewportStore.setScreenSize(host.clientWidth, host.clientHeight)

  // Sync viewport → store on every 'moved' event
  viewport.on('moved', () => {
    if (!viewport) return
    viewportStore.setPan(viewport.corner.x, viewport.corner.y)
    viewportStore.setZoom(viewport.scale.x)
  })

  // Frame loop: consume pending imperatives from store (fit/zoomToSelection commands)
  const tick = () => {
    if (!viewport) return
    if (viewportStore.consumeFitView()) {
      viewport.fitWorld()
    }
    const zoomTarget = viewportStore.consumeZoomToSelection()
    if (zoomTarget && zoomTarget.width > 0 && zoomTarget.height > 0) {
      viewport.snapZoom({
        width: zoomTarget.width,
        height: zoomTarget.height,
        removeOnComplete: true
      })
      viewport.snap(
        zoomTarget.x + zoomTarget.width / 2,
        zoomTarget.y + zoomTarget.height / 2,
        { removeOnComplete: true }
      )
    }
    rafHandle = requestAnimationFrame(tick)
  }
  rafHandle = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  if (rafHandle !== null) cancelAnimationFrame(rafHandle)
  if (viewport) {
    viewport.destroy({ children: true })
    viewport = null
  }
  if (app) {
    app.destroy(true, { children: true, texture: true })
    app = null
  }
})
</script>
