<template>
  <div ref="pixiHostRef" class="absolute inset-0 size-full" />
</template>

<script setup lang="ts">
import { Application } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'

import { MOSHPIT_QUEUE_INJECTION_KEY } from '@/platform/moshpit/composables/useMoshpitProcessingQueue'
import { useMoshpitSpacePan } from '@/platform/moshpit/composables/useMoshpitSpacePan'
import {
  MOSHPIT_LAYOUT_INJECTION_KEY,
  useMoshpitSpriteLayer
} from '@/platform/moshpit/composables/useMoshpitSpriteLayer'
import type { SpriteLayerHandle } from '@/platform/moshpit/composables/useMoshpitSpriteLayer'
import {
  MOSHPIT_SPRITE_HITTEST_INJECTION_KEY,
  MOSHPIT_VIEWPORT_INJECTION_KEY
} from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitViewportStore } from '@/platform/moshpit/stores/moshpitViewportStore'

defineOptions({ name: 'MoshpitCanvas' })

const { containerEl } = defineProps<{
  containerEl: HTMLElement
}>()

const pixiHostRef = ref<HTMLElement | null>(null)
const viewportStore = useMoshpitViewportStore()

const queue = inject(MOSHPIT_QUEUE_INJECTION_KEY)
if (!queue)
  throw new Error(
    'MoshpitCanvas requires MOSHPIT_QUEUE_INJECTION_KEY to be provided by MoshpitLayout'
  )

// Phase 3: layout provider injected from MoshpitLayout via useMoshpitFilteredAssets.
// Null when MoshpitLayout hasn't provided it (e.g. test isolation); sprite layer
// falls back to Phase 2 jittered-grid in that case.
const injectedLayout = inject(MOSHPIT_LAYOUT_INJECTION_KEY, null)

const viewportRef = inject(MOSHPIT_VIEWPORT_INJECTION_KEY)
if (!viewportRef)
  throw new Error(
    'MoshpitCanvas requires MOSHPIT_VIEWPORT_INJECTION_KEY to be provided by MoshpitView'
  )

const spriteHitTestRef = inject(MOSHPIT_SPRITE_HITTEST_INJECTION_KEY)
if (!spriteHitTestRef)
  throw new Error(
    'MoshpitCanvas requires MOSHPIT_SPRITE_HITTEST_INJECTION_KEY to be provided by MoshpitView'
  )

let app: Application | null = null
let viewport: Viewport | null = null
let spriteLayerRef: SpriteLayerHandle | null = null
let rafHandle: number | null = null
let cancelled = false
let resizeObs: ResizeObserver | null = null

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
  // Left-drag pans; marquee selection only engages when Cmd/Ctrl is held
  // (gated in MoshpitView.onContainerPointerDown). Space-drag, middle-drag,
  // and right-drag also pan. Pinch + wheel zoom.
  viewport
    .drag({ mouseButtons: 'all' })
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

  // Expose hit-testers to MoshpitView's pointer handlers.
  spriteHitTestRef.value = {
    hitTestPoint: spriteLayerRef.hitTestPoint,
    hitTestRect: spriteLayerRef.hitTestRect,
    getSpriteWorldPos: spriteLayerRef.getSpriteWorldPos,
    hitTestHandle: spriteLayerRef.hitTestHandle
  }

  viewportStore.setScreenSize(host.clientWidth, host.clientHeight)

  // Sync viewport → store on every 'moved' event
  viewport.on('moved', () => {
    if (!viewport) return
    viewportStore.setPan(viewport.corner.x, viewport.corner.y)
    viewportStore.setZoom(viewport.scale.x)
  })

  // Pixi's resizeTo only listens to `window` resize, so toggling the Settings
  // panel (which reflows the flex-1 host without resizing the window) leaves
  // the renderer at its initial size. Observe the host element directly and
  // propagate size changes to the app + viewport.
  resizeObs = new ResizeObserver(() => {
    if (!app || !viewport) return
    const w = host.clientWidth
    const h = host.clientHeight
    if (w === 0 || h === 0) return
    app.renderer.resize(w, h)
    viewport.resize(w, h)
    viewportStore.setScreenSize(w, h)
  })
  resizeObs.observe(host)

  // Frame loop: consume pending imperatives from store (fit/zoomToSelection commands)
  const tick = () => {
    if (cancelled || !viewport) return
    if (viewportStore.consumeFitView()) {
      viewport.fitWorld()
    }
    const zoomTarget = viewportStore.consumeZoomToSelection()
    if (zoomTarget && zoomTarget.width > 0 && zoomTarget.height > 0) {
      // pixi-viewport's `snapZoom({ width, height })` with both dimensions
      // scales x and y independently — that stretches the sprite layer.
      // Pick the limiting axis so the animation stays uniform and the
      // entire target bbox fits inside the screen.
      const screenW = viewport.screenWidth
      const screenH = viewport.screenHeight
      const limitByWidth =
        zoomTarget.width / screenW >= zoomTarget.height / screenH
      viewport.snapZoom(
        limitByWidth
          ? { width: zoomTarget.width, removeOnComplete: true }
          : { height: zoomTarget.height, removeOnComplete: true }
      )
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
  if (resizeObs) {
    resizeObs.disconnect()
    resizeObs = null
  }
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
  spriteHitTestRef.value = null
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
