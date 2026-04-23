import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Viewport } from 'pixi-viewport'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { defineComponent, h, ref } from 'vue'

import { createI18n } from 'vue-i18n'

import type { SpriteHitTester } from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

import type { SpriteDragHandle } from './useMoshpitSpriteDrag'
import { useMoshpitSpriteDrag } from './useMoshpitSpriteDrag'

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

function makeHitTester(hash: string | null): {
  ref: Ref<SpriteHitTester | null>
  tester: SpriteHitTester
} {
  const tester: SpriteHitTester = {
    hitTestPoint: vi
      .fn<(x: number, y: number) => string | null>()
      .mockReturnValue(hash),
    hitTestRect: vi.fn<() => string[]>().mockReturnValue([]),
    getSpriteWorldPos: vi
      .fn<(hash: string) => { x: number; y: number } | null>()
      .mockReturnValue(null)
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
  handle: SpriteDragHandle
  viewport: MockViewport
  containerEl: Ref<HTMLElement | null>
  hitRef: Ref<SpriteHitTester | null>
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

function makeI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        moshpit: {
          pin: {
            toastSingle: 'Pinned asset — broke auto-layout',
            toastMulti: 'Pinned {count} assets — broke auto-layout',
            undoLabel: 'Undo'
          }
        }
      }
    }
  })
}

function mountHarness(
  opts: { hash: string | null } = { hash: 'asset-1' }
): HarnessRefs {
  const containerEl = makeContainer()
  const viewport = makeViewport()
  const hit = makeHitTester(opts.hash)
  let handle!: SpriteDragHandle

  const wrapper = mount(Harness, {
    global: { plugins: [makeI18n()] },
    props: {
      run: () => {
        handle = useMoshpitSpriteDrag({
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
    containerEl,
    hitRef: hit.ref,
    unmount: () => wrapper.unmount()
  }
}

describe('useMoshpitSpriteDrag', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('engages on hit + no modifiers; isDragging=true after threshold exceeded', () => {
    const { handle } = mountHarness({ hash: 'asset-1' })

    const engaged = handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    expect(engaged).toBe(true)
    expect(handle.isDragging.value).toBe(false)

    dispatchDocPointerEvent('pointermove', { clientX: 120, clientY: 120 })
    expect(handle.isDragging.value).toBe(true)
  })

  it('does NOT engage on hit-test miss', () => {
    const { handle } = mountHarness({ hash: null })
    const engaged = handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 50, clientY: 50 })
    )
    expect(engaged).toBe(false)
    expect(handle.isDragging.value).toBe(false)
  })

  it.each([['ctrlKey'], ['metaKey'], ['shiftKey'], ['altKey']] as const)(
    'does NOT engage with %s held',
    (modifier) => {
      const { handle, viewport } = mountHarness({ hash: 'asset-1' })
      const engaged = handle.onPointerDown(
        makePointerEvent('pointerdown', {
          clientX: 100,
          clientY: 100,
          [modifier]: true
        })
      )
      expect(engaged).toBe(false)
      expect(viewport.plugins.pause).not.toHaveBeenCalled()
    }
  )

  it('does NOT engage when e.button !== 0', () => {
    const { handle } = mountHarness({ hash: 'asset-1' })
    const engaged = handle.onPointerDown(
      makePointerEvent('pointerdown', { button: 2, clientX: 100, clientY: 100 })
    )
    expect(engaged).toBe(false)
  })

  it('pauses viewport exactly once at engage, resumes exactly once at pointerup', () => {
    const { handle, viewport } = mountHarness({ hash: 'asset-1' })
    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    expect(viewport.plugins.pause).toHaveBeenCalledTimes(1)
    expect(viewport.plugins.pause).toHaveBeenCalledWith('drag')

    dispatchDocPointerEvent('pointermove', { clientX: 150, clientY: 150 })
    dispatchDocPointerEvent('pointerup', { clientX: 150, clientY: 150 })

    expect(viewport.plugins.resume).toHaveBeenCalledTimes(1)
    expect(viewport.plugins.resume).toHaveBeenCalledWith('drag')
  })

  it('writes setPin(hash, startAnchor + delta) on pointermove past threshold', () => {
    const { handle } = mountHarness({ hash: 'asset-1' })
    const overrideStore = useMoshpitOverrideStore()
    const setPinSpy = vi.spyOn(overrideStore, 'setPin')

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    // toWorld identity; anchor defaults to worldStart (100,100); delta = (60,40)
    dispatchDocPointerEvent('pointermove', { clientX: 160, clientY: 140 })

    expect(setPinSpy).toHaveBeenCalledWith('asset-1', { x: 160, y: 140 })
  })

  it('multi-select: drag set = selection when size > 1 and dragged hash is in selection', () => {
    const { handle } = mountHarness({ hash: 'asset-1' })
    const selection = useMoshpitSelectionStore()
    selection.setSelection(['asset-1', 'asset-2', 'asset-3'])

    const overrideStore = useMoshpitOverrideStore()
    // Seed asset-2 with a pre-existing pin so we can verify its own anchor
    overrideStore.setPin('asset-2', { x: 500, y: 500 })
    const setPinSpy = vi.spyOn(overrideStore, 'setPin')

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 110, clientY: 110 })

    // pointer world delta = (10,10); asset-1 anchor = worldStart (100,100) →
    // (110,110); asset-2 anchor = pinned (500,500) → (510,510);
    // asset-3 anchor = worldStart (100,100) → (110,110)
    expect(setPinSpy).toHaveBeenCalledWith('asset-1', { x: 110, y: 110 })
    expect(setPinSpy).toHaveBeenCalledWith('asset-2', { x: 510, y: 510 })
    expect(setPinSpy).toHaveBeenCalledWith('asset-3', { x: 110, y: 110 })
  })

  it('multi-select: drag set = [hash] when selection.size <= 1 OR draggedHash is not in selection', () => {
    const { handle } = mountHarness({ hash: 'asset-1' })
    const selection = useMoshpitSelectionStore()
    // dragged hash not in selection
    selection.setSelection(['asset-2', 'asset-3'])
    const overrideStore = useMoshpitOverrideStore()
    const setPinSpy = vi.spyOn(overrideStore, 'setPin')

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 110, clientY: 110 })

    const hashesWritten = new Set(setPinSpy.mock.calls.map((c) => c[0]))
    expect(hashesWritten).toEqual(new Set(['asset-1']))
  })

  it('below-threshold release: no setPin, viewport still resumed', () => {
    const { handle, viewport } = mountHarness({ hash: 'asset-1' })
    const overrideStore = useMoshpitOverrideStore()
    const setPinSpy = vi.spyOn(overrideStore, 'setPin')

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    // movement < threshold
    dispatchDocPointerEvent('pointermove', { clientX: 102, clientY: 101 })
    dispatchDocPointerEvent('pointerup', { clientX: 102, clientY: 101 })

    expect(setPinSpy).not.toHaveBeenCalled()
    expect(viewport.plugins.resume).toHaveBeenCalledTimes(1)
  })

  it('above-threshold release: toastStore.add called once with severity info and resolved summary', () => {
    const { handle } = mountHarness({ hash: 'asset-1' })
    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 160, clientY: 160 })
    dispatchDocPointerEvent('pointerup', { clientX: 160, clientY: 160 })

    expect(addSpy).toHaveBeenCalledTimes(1)
    const payload = addSpy.mock.calls[0]![0]
    expect(payload.severity).toBe('info')
    expect(payload.summary).toBe('Pinned asset — broke auto-layout')
    expect(payload.detail).toBe('Undo')
  })

  it('multi-select toast uses toastMulti with count', () => {
    const { handle } = mountHarness({ hash: 'asset-1' })
    const selection = useMoshpitSelectionStore()
    selection.setSelection(['asset-1', 'asset-2', 'asset-3'])
    const toastStore = useToastStore()
    const addSpy = vi.spyOn(toastStore, 'add')

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 160, clientY: 160 })
    dispatchDocPointerEvent('pointerup', { clientX: 160, clientY: 160 })

    expect(addSpy).toHaveBeenCalledTimes(1)
    expect(addSpy.mock.calls[0]![0].summary).toBe(
      'Pinned 3 assets — broke auto-layout'
    )
  })

  it('Escape during drag restores pre-drag snapshots, no toast, viewport resumed', () => {
    const { handle, viewport } = mountHarness({ hash: 'asset-1' })
    const selection = useMoshpitSelectionStore()
    selection.setSelection(['asset-1', 'asset-2'])

    const overrideStore = useMoshpitOverrideStore()
    // Seed: asset-1 pinned, asset-2 unpinned
    overrideStore.setPin('asset-1', { x: 10, y: 20 })
    const toastStore = useToastStore()
    const toastSpy = vi.spyOn(toastStore, 'add')

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 160, clientY: 160 })

    // Mid-drag: asset-1 was moved, asset-2 was pinned (previously unpinned)
    expect(overrideStore.isPinned('asset-2')).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    // asset-1 restored to original pin (10,20)
    expect(overrideStore.get('asset-1')?.pinnedWorldPos).toEqual({
      x: 10,
      y: 20
    })
    // asset-2 restored to unpinned
    expect(overrideStore.isPinned('asset-2')).toBe(false)
    expect(toastSpy).not.toHaveBeenCalled()
    expect(viewport.plugins.resume).toHaveBeenCalledTimes(1)
  })

  it('pointercancel mid-drag restores pre-drag state (no toast, viewport resumed)', () => {
    const { handle, viewport } = mountHarness({ hash: 'asset-1' })
    const overrideStore = useMoshpitOverrideStore()
    const toastStore = useToastStore()
    const toastSpy = vi.spyOn(toastStore, 'add')

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 160, clientY: 160 })
    expect(overrideStore.isPinned('asset-1')).toBe(true)

    dispatchDocPointerEvent('pointercancel', { clientX: 160, clientY: 160 })

    expect(overrideStore.isPinned('asset-1')).toBe(false)
    expect(toastSpy).not.toHaveBeenCalled()
    expect(viewport.plugins.resume).toHaveBeenCalledTimes(1)
  })

  it('onBeforeUnmount mid-drag: viewport resume called; subsequent pointermove does not write', () => {
    const { handle, viewport, unmount } = mountHarness({ hash: 'asset-1' })
    const overrideStore = useMoshpitOverrideStore()
    const setPinSpy = vi.spyOn(overrideStore, 'setPin')

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 160, clientY: 160 })
    expect(setPinSpy).toHaveBeenCalled()

    unmount()
    expect(viewport.plugins.resume).toHaveBeenCalled()

    setPinSpy.mockClear()
    dispatchDocPointerEvent('pointermove', { clientX: 200, clientY: 200 })
    expect(setPinSpy).not.toHaveBeenCalled()
  })

  it('undoLast() restores each hash from the last drag (pinned → re-pin, unpinned → unpin)', () => {
    const { handle } = mountHarness({ hash: 'asset-1' })
    const selection = useMoshpitSelectionStore()
    selection.setSelection(['asset-1', 'asset-2'])

    const overrideStore = useMoshpitOverrideStore()
    // Seed: asset-1 previously pinned at (10,20); asset-2 unpinned
    overrideStore.setPin('asset-1', { x: 10, y: 20 })

    handle.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    dispatchDocPointerEvent('pointermove', { clientX: 150, clientY: 150 })
    dispatchDocPointerEvent('pointerup', { clientX: 150, clientY: 150 })

    expect(overrideStore.isPinned('asset-1')).toBe(true)
    expect(overrideStore.isPinned('asset-2')).toBe(true)

    handle.undoLast()

    expect(overrideStore.get('asset-1')?.pinnedWorldPos).toEqual({
      x: 10,
      y: 20
    })
    expect(overrideStore.isPinned('asset-2')).toBe(false)
  })
})
