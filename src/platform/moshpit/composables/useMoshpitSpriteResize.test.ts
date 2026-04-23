import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Viewport } from 'pixi-viewport'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { defineComponent, h, ref } from 'vue'

import type { SpriteHitTester } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'

import type { SpriteResizeHandle } from './useMoshpitSpriteResize'
import { useMoshpitSpriteResize } from './useMoshpitSpriteResize'

interface MockViewport {
  toWorld: ReturnType<typeof vi.fn>
  plugins: { pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn> }
}

function makeContainer(): Ref<HTMLElement | null> {
  const el = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 })
  } as unknown as HTMLElement
  return ref(el)
}

function makeViewport(): { ref: Ref<Viewport | null>; mock: MockViewport } {
  const mock: MockViewport = {
    toWorld: vi
      .fn<(x: number, y: number) => { x: number; y: number }>()
      .mockImplementation((x, y) => ({ x, y })),
    plugins: {
      pause: vi.fn<(plugin: string) => void>(),
      resume: vi.fn<(plugin: string) => void>()
    }
  }
  const vpRef = ref(mock as unknown as Viewport) as Ref<Viewport | null>
  return { ref: vpRef, mock }
}

function makeHitTester(opts: {
  handle?: { hash: string; corner: 'tl' | 'tr' | 'bl' | 'br' } | null
  spriteCenter?: { x: number; y: number } | null
}): { ref: Ref<SpriteHitTester | null>; tester: SpriteHitTester } {
  const tester: SpriteHitTester = {
    hitTestPoint: vi.fn(() => null),
    hitTestRect: vi.fn(() => []),
    getSpriteWorldPos: vi
      .fn<(hash: string) => { x: number; y: number } | null>()
      .mockReturnValue(opts.spriteCenter ?? null),
    hitTestHandle: vi
      .fn<
        (
          x: number,
          y: number
        ) => { hash: string; corner: 'tl' | 'tr' | 'bl' | 'br' } | null
      >()
      .mockReturnValue(opts.handle ?? null)
  }
  const hitRef = ref(tester) as Ref<SpriteHitTester | null>
  return { ref: hitRef, tester }
}

function makePointerEvent(
  type: string,
  opts: {
    button?: number
    clientX?: number
    clientY?: number
    pointerId?: number
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
  } = {}
): PointerEvent {
  return {
    type,
    button: opts.button ?? 0,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    pointerId: opts.pointerId ?? 1,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false
  } as PointerEvent
}

function dispatchDocPointerEvent(
  type: string,
  opts: { clientX: number; clientY: number; pointerId?: number }
) {
  const evt = new PointerEvent(type, {
    clientX: opts.clientX,
    clientY: opts.clientY,
    pointerId: opts.pointerId ?? 1,
    bubbles: true
  })
  document.dispatchEvent(evt)
}

interface HarnessRefs {
  handle: SpriteResizeHandle
  viewport: MockViewport
  unmount: () => void
}

const Harness = defineComponent({
  props: {
    run: { type: Function, required: true }
  },
  setup(props) {
    ;(props.run as () => void)()
    return () => h('div')
  }
})

function mountHarness(opts: {
  handle?: { hash: string; corner: 'tl' | 'tr' | 'bl' | 'br' } | null
  spriteCenter?: { x: number; y: number } | null
}): HarnessRefs {
  const containerEl = makeContainer()
  const viewport = makeViewport()
  const hit = makeHitTester(opts)
  let handle!: SpriteResizeHandle

  const wrapper = mount(Harness, {
    props: {
      run: () => {
        handle = useMoshpitSpriteResize({
          containerEl,
          viewportRef: viewport.ref,
          hitTestRef: hit.ref
        })
      }
    }
  })
  return {
    handle,
    viewport: viewport.mock,
    unmount: () => wrapper.unmount()
  }
}

describe('useMoshpitSpriteResize', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('engages (true) on handle hit with button=0 and no modifiers', () => {
    const { handle, viewport } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    const engaged = handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 140, clientY: 140 })
    )
    expect(engaged).toBe(true)
    expect(handle.isResizing.value).toBe(true)
    expect(viewport.plugins.pause).toHaveBeenCalledTimes(1)
    expect(viewport.plugins.pause).toHaveBeenCalledWith('drag')
  })

  it('does NOT engage when hitTestHandle returns null', () => {
    const { handle, viewport } = mountHarness({ handle: null })
    const engaged = handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 50, clientY: 50 })
    )
    expect(engaged).toBe(false)
    expect(viewport.plugins.pause).not.toHaveBeenCalled()
  })

  it('does NOT engage when button !== 0', () => {
    const { handle } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    const engaged = handle.onPointerDown(
      makePointerEvent('pointerdown', {
        button: 2,
        clientX: 140,
        clientY: 140
      })
    )
    expect(engaged).toBe(false)
  })

  it.each([['ctrlKey'], ['metaKey'], ['shiftKey'], ['altKey']] as const)(
    'does NOT engage with %s held',
    (modifier) => {
      const { handle } = mountHarness({
        handle: { hash: 'asset-1', corner: 'br' },
        spriteCenter: { x: 100, y: 100 }
      })
      const engaged = handle.onPointerDown(
        makePointerEvent('pointerdown', {
          clientX: 140,
          clientY: 140,
          [modifier]: true
        })
      )
      expect(engaged).toBe(false)
    }
  )

  it('pauses viewport once at engage, resumes once at pointerup', () => {
    const { handle, viewport } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 140, clientY: 140 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 150, clientY: 150 })
    dispatchDocPointerEvent('pointerup', { clientX: 150, clientY: 150 })
    expect(viewport.plugins.pause).toHaveBeenCalledTimes(1)
    expect(viewport.plugins.resume).toHaveBeenCalledTimes(1)
    expect(viewport.plugins.resume).toHaveBeenCalledWith('drag')
  })

  it('pointermove writes setScale(hash, startScale × currentDist / startDist)', () => {
    const { handle } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    const store = useMoshpitOverrideStore()
    const spy = vi.spyOn(store, 'setScale')

    // Engage at (140,140): startDist = √((40)²+(40)²) ≈ 56.568
    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 140, clientY: 140 })
    )
    // Move to (180,180): dist = √((80)²+(80)²) ≈ 113.137 → ratio = 2
    dispatchDocPointerEvent('pointermove', { clientX: 180, clientY: 180 })
    expect(spy).toHaveBeenCalled()
    const lastCall = spy.mock.calls.at(-1)
    expect(lastCall?.[0]).toBe('asset-1')
    expect(lastCall?.[1]).toBeCloseTo(2, 5)
  })

  it('clamps scale to [MIN_SCALE=0.25, MAX_SCALE=5]', () => {
    const { handle } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    const store = useMoshpitOverrideStore()

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 140, clientY: 140 })
    )
    // Very large move → ratio way over 5
    dispatchDocPointerEvent('pointermove', { clientX: 1100, clientY: 1100 })
    expect(store.get('asset-1')?.scale).toBe(5)

    // Very small move → ratio way under 0.25
    dispatchDocPointerEvent('pointermove', { clientX: 101, clientY: 101 })
    expect(store.get('asset-1')?.scale).toBe(0.25)
  })

  it('pointerup near scale=1 (within 0.01) clears the scale override', () => {
    const { handle } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    const store = useMoshpitOverrideStore()
    const clearSpy = vi.spyOn(store, 'clearScale')

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 140, clientY: 140 })
    )
    // Move back to near start distance so scale ≈ 1
    dispatchDocPointerEvent('pointermove', { clientX: 140, clientY: 140 })
    dispatchDocPointerEvent('pointerup', { clientX: 140, clientY: 140 })

    expect(clearSpy).toHaveBeenCalledWith('asset-1')
    expect(store.get('asset-1')?.scale).toBeUndefined()
  })

  it('pointerup at scale outside epsilon persists the final setScale', () => {
    const { handle } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    const store = useMoshpitOverrideStore()

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 140, clientY: 140 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 180, clientY: 180 })
    dispatchDocPointerEvent('pointerup', { clientX: 180, clientY: 180 })

    expect(store.get('asset-1')?.scale).toBeCloseTo(2, 5)
  })

  it('Escape mid-resize restores pre-resize scale when no prior scale existed', () => {
    const { handle, viewport } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    const store = useMoshpitOverrideStore()

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 140, clientY: 140 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 180, clientY: 180 })
    expect(store.get('asset-1')?.scale).toBeCloseTo(2, 5)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(store.get('asset-1')?.scale).toBeUndefined()
    expect(viewport.plugins.resume).toHaveBeenCalledTimes(1)
    expect(handle.isResizing.value).toBe(false)
  })

  it('Escape mid-resize restores prior scale when one existed', () => {
    const { handle } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    const store = useMoshpitOverrideStore()
    store.setScale('asset-1', 1.5)

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 140, clientY: 140 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 180, clientY: 180 })
    // mid-resize: startScale=1.5, ratio=2 → 3.0
    expect(store.get('asset-1')?.scale).toBeCloseTo(3, 5)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(store.get('asset-1')?.scale).toBe(1.5)
  })

  it('pointercancel mid-resize restores pre-resize state and resumes viewport', () => {
    const { handle, viewport } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    const store = useMoshpitOverrideStore()

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 140, clientY: 140 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 180, clientY: 180 })
    expect(store.get('asset-1')?.scale).toBeCloseTo(2, 5)

    dispatchDocPointerEvent('pointercancel', { clientX: 180, clientY: 180 })

    expect(store.get('asset-1')?.scale).toBeUndefined()
    expect(viewport.plugins.resume).toHaveBeenCalledTimes(1)
  })

  it('unmount mid-resize resumes viewport and ignores subsequent pointermoves', () => {
    const { handle, viewport, unmount } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    const store = useMoshpitOverrideStore()
    const setScaleSpy = vi.spyOn(store, 'setScale')

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 140, clientY: 140 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 180, clientY: 180 })
    expect(setScaleSpy).toHaveBeenCalled()

    unmount()
    expect(viewport.plugins.resume).toHaveBeenCalled()

    setScaleSpy.mockClear()
    dispatchDocPointerEvent('pointermove', { clientX: 220, clientY: 220 })
    expect(setScaleSpy).not.toHaveBeenCalled()
  })

  it('zero-distance edge case: returns false without crashing or writing', () => {
    // Handle hit at the exact sprite center (degenerate — corners are non-zero
    // distance in practice, but guard the math).
    const { handle } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: { x: 100, y: 100 }
    })
    const store = useMoshpitOverrideStore()
    const setScaleSpy = vi.spyOn(store, 'setScale')

    const engaged = handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    expect(engaged).toBe(false)
    expect(setScaleSpy).not.toHaveBeenCalled()
  })

  it('does NOT engage when getSpriteWorldPos returns null', () => {
    const { handle } = mountHarness({
      handle: { hash: 'asset-1', corner: 'br' },
      spriteCenter: null
    })
    const engaged = handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 140, clientY: 140 })
    )
    expect(engaged).toBe(false)
  })
})
