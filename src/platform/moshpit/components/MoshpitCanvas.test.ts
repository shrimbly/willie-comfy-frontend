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

vi.mock('@/platform/moshpit/composables/useMoshpitCanvasInput', () => ({
  useMoshpitCanvasInput: vi.fn<() => void>()
}))

import { mount } from '@vue/test-utils'
import MoshpitCanvas from './MoshpitCanvas.vue'

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

  it('mounts without throwing when given a valid containerEl', async () => {
    const wrapper = mount(MoshpitCanvas, {
      props: { containerEl },
      attachTo: document.body
    })
    await vi.waitFor(() => expect(mocks.init).toHaveBeenCalled())
    wrapper.unmount()
  })

  it('calls Application init with correct options on mount', async () => {
    const wrapper = mount(MoshpitCanvas, {
      props: { containerEl },
      attachTo: document.body
    })
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
    const wrapper = mount(MoshpitCanvas, {
      props: { containerEl },
      attachTo: document.body
    })
    await vi.waitFor(() => expect(mocks.init).toHaveBeenCalled())
    wrapper.unmount()
    expect(mocks.destroy).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ children: true, texture: true })
    )
  })
})
