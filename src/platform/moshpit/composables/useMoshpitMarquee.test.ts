import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// Mock useKeyModifier before importing the composable
const mockShift = ref(false)
const mockCtrl = ref(false)
const mockMeta = ref(false)

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core')
  return {
    ...actual,
    useKeyModifier: vi.fn<(key: string) => ReturnType<typeof ref>>().mockImplementation((key: string) => {
      if (key === 'Shift') return mockShift
      if (key === 'Control') return mockCtrl
      if (key === 'Meta') return mockMeta
      return ref(false)
    })
  }
})

import { useMoshpitMarquee } from './useMoshpitMarquee'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'

function makeContainer() {
  const el = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
    setPointerCapture: vi.fn<() => void>(),
    releasePointerCapture: vi.fn<() => void>()
  } as unknown as HTMLElement
  return ref(el)
}

function makePointerEvent(
  type: string,
  opts: {
    button?: number
    clientX?: number
    clientY?: number
    pointerId?: number
    target?: EventTarget | null
  } = {}
) {
  const e = {
    type,
    button: opts.button ?? 0,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    pointerId: opts.pointerId ?? 1,
    target: opts.target ?? null
  } as PointerEvent
  return e
}

describe('useMoshpitMarquee', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockShift.value = false
    mockCtrl.value = false
    mockMeta.value = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initial state: isDragging=false, rect=null', () => {
    const containerEl = makeContainer()
    const { isDragging, rect } = useMoshpitMarquee({
      containerEl,
      hitTest: () => []
    })
    expect(isDragging.value).toBe(false)
    expect(rect.value).toBeNull()
  })

  it('pointerdown button=0 records start but does NOT set isDragging', () => {
    const containerEl = makeContainer()
    const { isDragging, onPointerDown } = useMoshpitMarquee({
      containerEl,
      hitTest: () => []
    })

    onPointerDown(makePointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 20 }))
    expect(isDragging.value).toBe(false)
  })

  it('pointerdown with button=1 (middle) does NOTHING', () => {
    const containerEl = makeContainer()
    const { isDragging, onPointerDown } = useMoshpitMarquee({
      containerEl,
      hitTest: () => []
    })

    onPointerDown(makePointerEvent('pointerdown', { button: 1, clientX: 10, clientY: 20 }))
    expect(isDragging.value).toBe(false)
  })

  it('pointerdown with button=2 (right) does NOTHING', () => {
    const containerEl = makeContainer()
    const { isDragging, onPointerDown } = useMoshpitMarquee({
      containerEl,
      hitTest: () => []
    })

    onPointerDown(makePointerEvent('pointerdown', { button: 2, clientX: 10, clientY: 20 }))
    expect(isDragging.value).toBe(false)
  })

  it('pointermove under 5px threshold: isDragging stays false', () => {
    const containerEl = makeContainer()
    const { isDragging, onPointerDown } = useMoshpitMarquee({
      containerEl,
      hitTest: () => []
    })

    onPointerDown(makePointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 }))
    // simulate pointermove with 3px movement (under threshold — wasDragged returns false)
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 103, clientY: 100, pointerId: 1, bubbles: true }))
    // isDragging should still be false (we use the guard internally)
    expect(isDragging.value).toBe(false)
  })

  it('pointermove over threshold: isDragging=true, rect contains min/max bounds', () => {
    const containerEl = makeContainer()
    const { isDragging, rect, onPointerDown } = useMoshpitMarquee({
      containerEl,
      hitTest: () => []
    })

    onPointerDown(makePointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 }))

    // Simulate a real pointermove event dispatched to document
    const moveEvt = new PointerEvent('pointermove', {
      clientX: 160,
      clientY: 130,
      pointerId: 1,
      bubbles: true
    })
    document.dispatchEvent(moveEvt)

    expect(isDragging.value).toBe(true)
    expect(rect.value).not.toBeNull()
    expect(rect.value!.left).toBe(100)
    expect(rect.value!.top).toBe(100)
    expect(rect.value!.right).toBe(160)
    expect(rect.value!.bottom).toBe(130)
  })

  it('pointerup without drag (below threshold): NO call to selection store', () => {
    const containerEl = makeContainer()
    const { onPointerDown } = useMoshpitMarquee({
      containerEl,
      hitTest: () => ['asset-1']
    })
    const selection = useMoshpitSelectionStore()
    const setSelectionSpy = vi.spyOn(selection, 'setSelection')

    onPointerDown(makePointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 }))
    // pointerup without significant movement
    const upEvt = new PointerEvent('pointerup', {
      clientX: 101,
      clientY: 100,
      pointerId: 1,
      bubbles: true
    })
    document.dispatchEvent(upEvt)

    expect(setSelectionSpy).not.toHaveBeenCalled()
  })

  it('pointerup after drag with no modifier: calls setSelection with hitTest results', () => {
    const containerEl = makeContainer()
    const hitTestFn = vi.fn<() => string[]>().mockReturnValue(['asset-1', 'asset-2'])
    const { onPointerDown } = useMoshpitMarquee({
      containerEl,
      hitTest: hitTestFn
    })
    const selection = useMoshpitSelectionStore()
    const setSelectionSpy = vi.spyOn(selection, 'setSelection')

    onPointerDown(makePointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 }))
    // Move past threshold
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, clientY: 160, pointerId: 1, bubbles: true }))
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 160, pointerId: 1, bubbles: true }))

    expect(setSelectionSpy).toHaveBeenCalledWith(['asset-1', 'asset-2'])
  })

  it('Shift+drag commits addMany merged with pre-drag selection', () => {
    const containerEl = makeContainer()
    const hitTestFn = vi.fn<() => string[]>().mockReturnValue(['asset-3'])
    const { onPointerDown } = useMoshpitMarquee({
      containerEl,
      hitTest: hitTestFn
    })
    const selection = useMoshpitSelectionStore()
    // Set some pre-existing selection
    selection.setSelection(['asset-1', 'asset-2'])

    const setSelectionSpy = vi.spyOn(selection, 'setSelection')
    mockShift.value = true

    onPointerDown(makePointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 }))
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, clientY: 160, pointerId: 1, bubbles: true }))
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 160, pointerId: 1, bubbles: true }))

    // Should contain pre-drag + hitTest results merged
    expect(setSelectionSpy).toHaveBeenCalledWith(
      expect.arrayContaining(['asset-1', 'asset-2', 'asset-3'])
    )
    const called = setSelectionSpy.mock.calls[0]![0] as string[]
    expect(called).toHaveLength(3)
  })

  it('Ctrl+drag XOR-toggles hitIds against pre-drag selection', () => {
    const containerEl = makeContainer()
    // pre-drag: ['asset-1', 'asset-2'], hit: ['asset-2', 'asset-3']
    // XOR result: ['asset-1', 'asset-3'] (asset-2 removed, asset-3 added)
    const hitTestFn = vi.fn<() => string[]>().mockReturnValue(['asset-2', 'asset-3'])
    const { onPointerDown } = useMoshpitMarquee({
      containerEl,
      hitTest: hitTestFn
    })
    const selection = useMoshpitSelectionStore()
    selection.setSelection(['asset-1', 'asset-2'])

    const setSelectionSpy = vi.spyOn(selection, 'setSelection')
    mockCtrl.value = true

    onPointerDown(makePointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 }))
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, clientY: 160, pointerId: 1, bubbles: true }))
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 160, pointerId: 1, bubbles: true }))

    expect(setSelectionSpy).toHaveBeenCalledWith(
      expect.arrayContaining(['asset-1', 'asset-3'])
    )
    const called = setSelectionSpy.mock.calls[0]![0] as string[]
    expect(called).toHaveLength(2)
    expect(called).not.toContain('asset-2')
  })

  it('cancel() resets state without committing to store', () => {
    const containerEl = makeContainer()
    const hitTestFn = vi.fn<() => string[]>().mockReturnValue(['asset-1'])
    const { isDragging, rect, onPointerDown, cancel } = useMoshpitMarquee({
      containerEl,
      hitTest: hitTestFn
    })
    const selection = useMoshpitSelectionStore()
    const setSelectionSpy = vi.spyOn(selection, 'setSelection')

    onPointerDown(makePointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 }))
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, clientY: 160, pointerId: 1, bubbles: true }))

    expect(isDragging.value).toBe(true)

    cancel()

    expect(isDragging.value).toBe(false)
    expect(rect.value).toBeNull()
    expect(setSelectionSpy).not.toHaveBeenCalled()
  })

  it('Phase 1 empty hitTest: pointerup after drag calls setSelection([]) without error', () => {
    const containerEl = makeContainer()
    const { onPointerDown } = useMoshpitMarquee({
      containerEl,
      hitTest: () => []
    })
    const selection = useMoshpitSelectionStore()
    const setSelectionSpy = vi.spyOn(selection, 'setSelection')

    onPointerDown(makePointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 }))
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, clientY: 160, pointerId: 1, bubbles: true }))
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 160, pointerId: 1, bubbles: true }))

    expect(setSelectionSpy).toHaveBeenCalledWith([])
  })
})
