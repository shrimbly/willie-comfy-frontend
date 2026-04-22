import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted ensures these refs are available at mock factory evaluation time
const mocks = vi.hoisted(() => ({
  init: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  destroy: vi.fn<() => void>(),
  stageAddChild: vi.fn<() => void>(),
  viewportDestroy: vi.fn<() => void>()
}))

// Use class syntax so `new Application()` works correctly
vi.mock('pixi.js', () => {
  class MockApplication {
    canvas = document.createElement('canvas')
    init = mocks.init
    stage = { addChild: mocks.stageAddChild }
    renderer = { events: {} }
    destroy = mocks.destroy
  }
  return { Application: MockApplication }
})

vi.mock('pixi-viewport', () => {
  class MockViewport {
    corner = { x: 0, y: 0 }
    scale = { x: 1, y: 1 }
    plugins = { remove: vi.fn<() => void>() }
    on = vi.fn<() => this>().mockReturnThis()
    drag = vi.fn<() => this>().mockReturnThis()
    pinch = vi.fn<() => this>().mockReturnThis()
    wheel = vi.fn<() => this>().mockReturnThis()
    decelerate = vi.fn<() => this>().mockReturnThis()
    destroy = mocks.viewportDestroy
    fitWorld = vi.fn<() => void>()
    snapZoom = vi.fn<() => this>().mockReturnThis()
    snap = vi.fn<() => this>().mockReturnThis()
  }
  return { Viewport: MockViewport }
})

vi.mock('@/platform/moshpit/composables/useMoshpitSpacePan', () => ({
  useMoshpitSpacePan: vi.fn<() => void>()
}))

vi.mock('@/platform/moshpit/composables/useMoshpitSpriteLayer', () => ({
  useMoshpitSpriteLayer: vi.fn(() => ({
    destroy: vi.fn(),
    hitTestPoint: vi.fn(() => null),
    hitTestRect: vi.fn(() => [])
  })),
  MOSHPIT_LAYOUT_INJECTION_KEY: Symbol('moshpit:layout'),
  DEFAULT_CELL_SIZE: 560,
  REPACK_DURATION_MS: 300
}))

import type { Viewport } from 'pixi-viewport'
import { computed, ref, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import { MOSHPIT_QUEUE_INJECTION_KEY } from '@/platform/moshpit/composables/useMoshpitProcessingQueue'
import type { SpriteHitTester } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import {
  MOSHPIT_SPRITE_HITTEST_INJECTION_KEY,
  MOSHPIT_VIEWPORT_INJECTION_KEY
} from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import MoshpitCanvas from './MoshpitCanvas.vue'

const fakeQueue = {
  total: ref(0),
  done: ref(0),
  activeFilterId: ref(''),
  isActive: computed(() => false),
  setFilter: vi.fn(),
  cancel: vi.fn(),
  destroy: vi.fn()
}

describe('MoshpitCanvas', () => {
  let containerEl: HTMLDivElement

  beforeEach(() => {
    setActivePinia(createPinia())
    containerEl = document.createElement('div')
    document.body.appendChild(containerEl)
    vi.clearAllMocks()
    mocks.init.mockResolvedValue(undefined)
  })

  afterEach(() => {
    if (containerEl.parentNode) {
      document.body.removeChild(containerEl)
    }
  })

  const mountCanvas = (el: HTMLElement) =>
    mount(MoshpitCanvas, {
      props: { containerEl: el },
      attachTo: document.body,
      global: {
        provide: {
          [MOSHPIT_QUEUE_INJECTION_KEY as symbol]: fakeQueue,
          [MOSHPIT_VIEWPORT_INJECTION_KEY as symbol]:
            shallowRef<Viewport | null>(null),
          [MOSHPIT_SPRITE_HITTEST_INJECTION_KEY as symbol]:
            shallowRef<SpriteHitTester | null>(null)
        }
      }
    })

  it('mounts without throwing when given a valid containerEl', async () => {
    const wrapper = mountCanvas(containerEl)
    await vi.waitFor(() => expect(mocks.init).toHaveBeenCalled())
    wrapper.unmount()
  })

  it('calls Application init with correct options on mount', async () => {
    const wrapper = mountCanvas(containerEl)
    await vi.waitFor(() => expect(mocks.init).toHaveBeenCalled())
    expect(mocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        antialias: false,
        autoDensity: true
      })
    )
    wrapper.unmount()
  })

  it('calls app.destroy on unmount', async () => {
    const wrapper = mountCanvas(containerEl)
    await vi.waitFor(() => expect(mocks.init).toHaveBeenCalled())
    wrapper.unmount()
    expect(mocks.destroy).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ children: true, texture: true })
    )
  })
})
