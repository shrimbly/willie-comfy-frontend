<template>
  <div ref="pixiHostRef" class="absolute inset-0 size-full" />
</template>

<script setup lang="ts">
import { Application } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { inject, onBeforeUnmount, onMounted, provide, ref, shallowRef } from 'vue'

import {
  MOSHPIT_QUEUE_INJECTION_KEY
} from '@/platform/moshpit/composables/useMoshpitProcessingQueue'
import { useMoshpitSpacePan } from '@/platform/moshpit/composables/useMoshpitSpacePan'
import {
  MOSHPIT_LAYOUT_INJECTION_KEY,
  useMoshpitSpriteLayer
} from '@/platform/moshpit/composables/useMoshpitSpriteLayer'
import { MOSHPIT_VIEWPORT_INJECTION_KEY } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitViewportStore } from '@/platform/moshpit/stores/moshpitViewportStore'

defineOptions({ name: 'MoshpitCanvas' })

const { containerEl } = defineProps<{
  containerEl: HTMLElement
}>()

const pixiHostRef = ref<HTMLElement | null>(null)
const viewportStore = useMoshpitViewportStore()

const queue = inject(MOSHPIT_QUEUE_INJECTION_KEY)
if (!queue) throw new Error('MoshpitCanvas requires MOSHPIT_QUEUE_INJECTION_KEY to be provided by MoshpitLayout')

// Phase 3: layout provider injected from MoshpitLayout via useMoshpitFilteredAssets.
// Null when MoshpitLayout hasn't provided it (e.g. test isolation); sprite layer
// falls back to Phase 2 jittered-grid in that case.
const injectedLayout = inject(MOSHPIT_LAYOUT_INJECTION_KEY, null)

const viewportRef = shallowRef<Viewport | null>(null)
provide(MOSHPIT_VIEWPORT_INJECTION_KEY, viewportRef)

let app: Application | null = null
let viewport: Viewport | null = null
let spriteLayerRef: { destroy(): void } | null = null
let rafHandle: number | null = null
let cancelled = false

const WORLD_SIZE = 10_000

onMounted(async () => {
  const host = pixiHostRef.value
  if (!host) return

  const pending = new Application()
  await pending.init({
    resizeTo: host,
    background: 0x111111,
    antialias: false,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1
  })
  // Component unmounted while awaiting init — discard and bail out so we don't
  // leak the Application, the canvas DOM node, or the RAF loop.
  if (cancelled) {
    pending.destroy(true, { children: true, texture: true })
    return
  }
  app = pending
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

  viewportRef.value = viewport // expose to overlay consumers after init

  useMoshpitSpacePan(viewport, containerEl)

  // Mount sprite layer after viewport is ready. Sprite container lives under
  // the viewport so world-space pan/zoom transforms it automatically.
  // Teardown order: sprite layer first, then app.destroy (see onBeforeUnmount).
  spriteLayerRef = useMoshpitSpriteLayer({
    viewport,
    ticker: app.ticker,
    queue,
    layoutProvider: injectedLayout ?? undefined
  })

  viewportStore.setScreenSize(host.clientWidth, host.clientHeight)

  // Sync viewport → store on every 'moved' event
  viewport.on('moved', () => {
    if (!viewport) return
    viewportStore.setPan(viewport.corner.x, viewport.corner.y)
    viewportStore.setZoom(viewport.scale.x)
  })

  // Frame loop: consume pending imperatives from store (fit/zoomToSelection commands)
  const tick = () => {
    if (cancelled || !viewport) return
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
  cancelled = true
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle)
    rafHandle = null
  }
  // Destroy sprite layer before app.destroy so we get a clean error channel
  // (the sprite container lives under the viewport; app.destroy would cascade
  // to it, but explicit destroy here lets us track errors independently).
  if (spriteLayerRef) {
    spriteLayerRef.destroy()
    spriteLayerRef = null
  }
  // Application.destroy with { children: true } cascades through the stage and
  // tears the viewport down with it, so we don't call viewport.destroy() here
  // to avoid double-free / "already destroyed" warnings from pixi-viewport.
  viewportRef.value = null // consumers unsubscribe cleanly before app teardown
  viewport = null
  if (app) {
    app.destroy(true, { children: true, texture: true })
    app = null
  }
})
</script>
