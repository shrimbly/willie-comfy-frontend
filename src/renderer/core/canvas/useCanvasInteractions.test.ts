import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'

// Mutable canvas ref so shouldHandleNodePointerEvents tests can control it
let mockCanvasValue: LGraphCanvas | null = null

// Mock stores
vi.mock('@/renderer/core/canvas/canvasStore', () => {
  const getCanvas = vi.fn()
  const setCursorStyle = vi.fn()
  return {
    useCanvasStore: vi.fn(() => ({
      get canvas() {
        return mockCanvasValue
      },
      getCanvas,
      setCursorStyle
    }))
  }
})
vi.mock('@/platform/settings/settingStore', () => {
  const getFn = vi.fn()
  return { useSettingStore: vi.fn(() => ({ get: getFn })) }
})
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      canvas: {
        dispatchEvent: vi.fn()
      }
    }
  }
}))

function createMockLGraphCanvas(read_only = true): LGraphCanvas {
  const mockCanvas: Partial<LGraphCanvas> = { read_only }
  return mockCanvas as LGraphCanvas
}

function createMockPointerEvent(
  buttons: PointerEvent['buttons'] = 1
): PointerEvent {
  const mockEvent: Partial<PointerEvent> = {
    buttons,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
  return mockEvent as PointerEvent
}

function createMockWheelEvent(ctrlKey = false, metaKey = false): WheelEvent {
  const mockEvent: Partial<WheelEvent> = {
    ctrlKey,
    metaKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
  return mockEvent as WheelEvent
}

function createMockWheelEventWithTarget(opts: {
  ctrl?: boolean
  meta?: boolean
  clientX?: number
  clientY?: number
  deltaX?: number
  deltaY?: number
  shift?: boolean
  target?: Element
}): WheelEvent {
  const mockEvent: Partial<WheelEvent> = {
    ctrlKey: opts.ctrl ?? false,
    metaKey: opts.meta ?? false,
    shiftKey: opts.shift ?? false,
    clientX: opts.clientX ?? 100,
    clientY: opts.clientY ?? 200,
    deltaX: opts.deltaX ?? 0,
    deltaY: opts.deltaY ?? 10,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
  if (opts.target !== undefined) {
    Object.defineProperty(mockEvent, 'target', { value: opts.target })
  }
  return mockEvent as WheelEvent
}

function createMockCaptureWheelElement(focused: boolean): HTMLElement {
  const captureElement = document.createElement('div')
  captureElement.setAttribute('data-capture-wheel', 'true')
  const inner = document.createElement('textarea')
  captureElement.appendChild(inner)
  document.body.appendChild(captureElement)
  if (focused) {
    inner.focus()
  }
  return captureElement
}

describe('useCanvasInteractions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockCanvasValue = null
  })

  describe('handlePointer', () => {
    it('should intercept left mouse events when canvas is read_only to enable space+drag navigation', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(true)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)

      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(1) // Left Mouse Button
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should forward middle mouse button events to canvas', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(false)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(4) // Middle mouse button
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should not prevent default when canvas is not in read_only mode and not middle button', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(false)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(1)
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })

    it('should return early when canvas is null', () => {
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(null!)
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(1)
      handlePointer(mockEvent)

      expect(getCanvas).toHaveBeenCalled()
      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })

    it('should dispatch and call preventDefault+stopPropagation for buttons=1 with read_only=true', () => {
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(createMockLGraphCanvas(true))
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(1)
      handlePointer(mockEvent)

      // preventDefault may be called multiple times (handlePointer + forwardEventToCanvas)
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should not dispatch for buttons=1 with read_only=false', () => {
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(createMockLGraphCanvas(false))
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(1)
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })

    it('should dispatch and call preventDefault+stopPropagation for buttons=4 (middle mouse) regardless of read_only', () => {
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(createMockLGraphCanvas(false))
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(4)
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should not dispatch for buttons=2 (right mouse) with read_only=false', () => {
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(createMockLGraphCanvas(false))
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(2)
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })
  })

  describe('shouldHandleNodePointerEvents', () => {
    it('should be true when canvas.read_only is false', () => {
      mockCanvasValue = createMockLGraphCanvas(false)
      const { shouldHandleNodePointerEvents } = useCanvasInteractions()
      expect(shouldHandleNodePointerEvents.value).toBe(true)
    })

    it('should be false when canvas.read_only is true', () => {
      mockCanvasValue = createMockLGraphCanvas(true)
      const { shouldHandleNodePointerEvents } = useCanvasInteractions()
      expect(shouldHandleNodePointerEvents.value).toBe(false)
    })
  })

  describe('handleWheel', () => {
    it('should forward ctrl+wheel events to canvas in standard nav mode', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')

      const { handleWheel } = useCanvasInteractions()

      // Ctrl key pressed
      const mockEvent = createMockWheelEvent(true)

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should forward all wheel events to canvas in legacy nav mode', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')
      const { handleWheel } = useCanvasInteractions()

      const mockEvent = createMockWheelEvent()
      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should not prevent default for regular wheel events in standard nav mode', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')
      const { handleWheel } = useCanvasInteractions()

      const mockEvent = createMockWheelEvent()
      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })
    it('should forward wheel events to canvas when capture element is NOT focused', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')

      const captureElement = document.createElement('div')
      captureElement.setAttribute('data-capture-wheel', 'true')
      const textarea = document.createElement('textarea')
      captureElement.appendChild(textarea)
      document.body.appendChild(captureElement)

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEvent()
      Object.defineProperty(mockEvent, 'target', { value: textarea })

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()

      document.body.removeChild(captureElement)
    })

    it('should NOT forward wheel events when capture element IS focused', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')

      const captureElement = document.createElement('div')
      captureElement.setAttribute('data-capture-wheel', 'true')
      const textarea = document.createElement('textarea')
      captureElement.appendChild(textarea)
      document.body.appendChild(captureElement)
      textarea.focus()

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEvent()
      Object.defineProperty(mockEvent, 'target', { value: textarea })

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()

      document.body.removeChild(captureElement)
    })

    it('should forward ctrl+wheel to canvas when capture element IS focused in standard mode', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')

      const captureElement = document.createElement('div')
      captureElement.setAttribute('data-capture-wheel', 'true')
      const textarea = document.createElement('textarea')
      captureElement.appendChild(textarea)
      document.body.appendChild(captureElement)
      textarea.focus()

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEvent(true)
      Object.defineProperty(mockEvent, 'target', { value: textarea })

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()

      document.body.removeChild(captureElement)
    })

    it('should call dispatchEvent exactly once with a reconstructed WheelEvent', async () => {
      const { get } = useSettingStore()
      // Use legacy mode: all wheel events are forwarded, no ctrlKey needed.
      // This pins that forwardEventToCanvas creates a new WheelEvent via constructor.
      vi.mocked(get).mockReturnValue('legacy')

      const { app } = await import('@/scripts/app')
      vi.mocked(app.canvas.canvas.dispatchEvent).mockClear()

      const { handleWheel } = useCanvasInteractions()
      // Use a real WheelEvent so `event instanceof WheelEvent` passes in production code.
      // happy-dom's WheelEvent does not persist ctrlKey from the constructor init dict,
      // so we test the dispatch path via legacy mode instead.
      const realEvent = new WheelEvent('wheel', { deltaY: 10 })
      handleWheel(realEvent)

      expect(app.canvas.canvas.dispatchEvent).toHaveBeenCalledTimes(1)
      const dispatched = vi.mocked(app.canvas.canvas.dispatchEvent).mock
        .calls[0][0] as Event
      // The production code reconstructs via `new WheelEvent(...)` — verify the constructor name
      expect(dispatched.constructor.name).toBe('WheelEvent')
    })

    it('should NOT dispatch for plain wheel (no Ctrl/Meta) in standard mode without capture element', async () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockImplementation((key: string) =>
        key === 'Comfy.Canvas.NavigationMode' ? 'standard' : undefined
      )

      const { app } = await import('@/scripts/app')
      vi.mocked(app.canvas.canvas.dispatchEvent).mockClear()

      const { handleWheel } = useCanvasInteractions()
      // Event target is NOT inside a capture-wheel element
      const mockEvent = createMockWheelEventWithTarget({
        ctrl: false,
        meta: false
      })
      handleWheel(mockEvent)

      expect(app.canvas.canvas.dispatchEvent).not.toHaveBeenCalled()
    })

    it('should dispatch on legacy nav + plain wheel', async () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')

      const { app } = await import('@/scripts/app')
      vi.mocked(app.canvas.canvas.dispatchEvent).mockClear()

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEventWithTarget({ ctrl: false })
      handleWheel(mockEvent)

      expect(app.canvas.canvas.dispatchEvent).toHaveBeenCalledTimes(1)
    })

    it('should NOT dispatch over focused capture-wheel element in standard mode without Ctrl', async () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')

      const { app } = await import('@/scripts/app')
      vi.mocked(app.canvas.canvas.dispatchEvent).mockClear()

      const captureEl = createMockCaptureWheelElement(true) // focused=true
      const target = captureEl.querySelector('textarea')!

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEventWithTarget({
        ctrl: false,
        target
      })
      handleWheel(mockEvent)

      expect(app.canvas.canvas.dispatchEvent).not.toHaveBeenCalled()

      document.body.removeChild(captureEl)
    })

    it('should dispatch over focused capture-wheel element in standard mode WITH Ctrl', async () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')

      const { app } = await import('@/scripts/app')
      vi.mocked(app.canvas.canvas.dispatchEvent).mockClear()

      const captureEl = createMockCaptureWheelElement(true) // focused=true
      const target = captureEl.querySelector('textarea')!

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEventWithTarget({
        ctrl: true,
        target
      })
      handleWheel(mockEvent)

      expect(app.canvas.canvas.dispatchEvent).toHaveBeenCalledTimes(1)

      document.body.removeChild(captureEl)
    })
  })

  describe('forwardEventToCanvas', () => {
    it('should reconstruct WheelEvent preserving deltaX and deltaY fields', async () => {
      const { app } = await import('@/scripts/app')
      vi.mocked(app.canvas.canvas.dispatchEvent).mockClear()

      const { forwardEventToCanvas } = useCanvasInteractions()

      // Use a real WheelEvent so `event instanceof WheelEvent` passes in production code.
      // happy-dom's WheelEvent constructor propagates deltaX/deltaY but not clientX/clientY
      // or modifier keys (MouseEventInit fields) — pin what the environment supports.
      const originalEvent = new WheelEvent('wheel', {
        deltaX: 5,
        deltaY: 15
      })

      forwardEventToCanvas(originalEvent)

      expect(app.canvas.canvas.dispatchEvent).toHaveBeenCalledTimes(1)
      const dispatched = vi.mocked(app.canvas.canvas.dispatchEvent).mock
        .calls[0][0] as WheelEvent
      expect(dispatched.constructor.name).toBe('WheelEvent')
      expect(dispatched.deltaX).toBe(5)
      expect(dispatched.deltaY).toBe(15)
    })

    it('should reconstruct a PointerEvent via its constructor preserving type', async () => {
      const { app } = await import('@/scripts/app')
      vi.mocked(app.canvas.canvas.dispatchEvent).mockClear()

      const { forwardEventToCanvas } = useCanvasInteractions()
      const originalEvent = new PointerEvent('pointermove', {
        buttons: 1,
        clientX: 10,
        clientY: 20
      })

      forwardEventToCanvas(originalEvent)

      expect(app.canvas.canvas.dispatchEvent).toHaveBeenCalledTimes(1)
      const dispatched = vi.mocked(app.canvas.canvas.dispatchEvent).mock
        .calls[0][0]
      expect(dispatched).toBeInstanceOf(PointerEvent)
      expect((dispatched as PointerEvent).type).toBe('pointermove')
    })

    it('should reconstruct a MouseEvent via its constructor preserving type', async () => {
      const { app } = await import('@/scripts/app')
      vi.mocked(app.canvas.canvas.dispatchEvent).mockClear()

      const { forwardEventToCanvas } = useCanvasInteractions()
      const originalEvent = new MouseEvent('mousedown', {
        buttons: 1,
        clientX: 30,
        clientY: 40
      })

      forwardEventToCanvas(originalEvent)

      expect(app.canvas.canvas.dispatchEvent).toHaveBeenCalledTimes(1)
      const dispatched = vi.mocked(app.canvas.canvas.dispatchEvent).mock
        .calls[0][0]
      expect(dispatched).toBeInstanceOf(MouseEvent)
      expect((dispatched as MouseEvent).type).toBe('mousedown')
    })
  })
})
