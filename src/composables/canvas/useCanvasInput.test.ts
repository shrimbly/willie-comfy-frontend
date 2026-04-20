import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasInputNavigator } from '@/composables/canvas/useCanvasInput'
import { useCanvasInput } from '@/composables/canvas/useCanvasInput'

function createFakeNavigator(opts: {
  standard?: boolean
  readOnly?: boolean
} = {}) {
  const dispatchWheel = vi.fn()
  const dispatchPointer = vi.fn()
  return {
    navigator: {
      isStandardNavMode: () => opts.standard ?? true,
      isReadOnly: () => opts.readOnly ?? false,
      dispatchWheel,
      dispatchPointer
    } satisfies CanvasInputNavigator,
    dispatchWheel,
    dispatchPointer
  }
}

function createMockWheelEvent(opts: {
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  deltaY?: number
  target?: Element
} = {}): WheelEvent {
  const mockEvent: Partial<WheelEvent> = {
    type: 'wheel',
    ctrlKey: opts.ctrl ?? false,
    metaKey: opts.meta ?? false,
    shiftKey: opts.shift ?? false,
    deltaX: 0,
    deltaY: opts.deltaY ?? 10,
    clientX: 0,
    clientY: 0,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
  if (opts.target !== undefined) {
    Object.defineProperty(mockEvent, 'target', { value: opts.target })
  }
  return mockEvent as WheelEvent
}

function createMockPointerEvent(opts: {
  buttons?: number
} = {}): PointerEvent {
  const mockEvent: Partial<PointerEvent> = {
    buttons: opts.buttons ?? 1,
    button: -1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
  return mockEvent as PointerEvent
}

function createCaptureWheelElement(focused: boolean): HTMLElement {
  const captureEl = document.createElement('div')
  captureEl.setAttribute('data-capture-wheel', 'true')
  const inner = document.createElement('textarea')
  captureEl.appendChild(inner)
  document.body.appendChild(captureEl)
  if (focused) inner.focus()
  return captureEl
}

describe('useCanvasInput', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('handleWheel', () => {
    it('should call dispatchWheel on standard nav + Ctrl+wheel', () => {
      const { navigator, dispatchWheel } = createFakeNavigator({
        standard: true
      })
      const { handleWheel } = useCanvasInput(navigator)
      const event = createMockWheelEvent({ ctrl: true })
      handleWheel(event)
      expect(dispatchWheel).toHaveBeenCalledTimes(1)
    })

    it('should NOT call dispatchWheel on standard nav + plain wheel (target not in capture)', () => {
      const { navigator, dispatchWheel } = createFakeNavigator({
        standard: true
      })
      const { handleWheel } = useCanvasInput(navigator)
      const event = createMockWheelEvent({ ctrl: false, meta: false })
      handleWheel(event)
      expect(dispatchWheel).not.toHaveBeenCalled()
    })

    it('should call dispatchWheel on legacy nav + plain wheel', () => {
      const { navigator, dispatchWheel } = createFakeNavigator({
        standard: false
      })
      const { handleWheel } = useCanvasInput(navigator)
      const event = createMockWheelEvent({ ctrl: false })
      handleWheel(event)
      expect(dispatchWheel).toHaveBeenCalledTimes(1)
    })

    it('should NOT call dispatchWheel over focused capture-wheel element without Ctrl in standard mode', () => {
      const { navigator, dispatchWheel } = createFakeNavigator({
        standard: true
      })
      const { handleWheel } = useCanvasInput(navigator)

      const captureEl = createCaptureWheelElement(true) // focused=true
      const target = captureEl.querySelector('textarea')!

      const event = createMockWheelEvent({ ctrl: false, target })
      handleWheel(event)

      expect(dispatchWheel).not.toHaveBeenCalled()
      document.body.removeChild(captureEl)
    })

    it('should call dispatchWheel over focused capture-wheel element WITH Ctrl in standard mode', () => {
      const { navigator, dispatchWheel } = createFakeNavigator({
        standard: true
      })
      const { handleWheel } = useCanvasInput(navigator)

      const captureEl = createCaptureWheelElement(true) // focused=true
      const target = captureEl.querySelector('textarea')!

      const event = createMockWheelEvent({ ctrl: true, target })
      handleWheel(event)

      expect(dispatchWheel).toHaveBeenCalledTimes(1)
      document.body.removeChild(captureEl)
    })
  })

  describe('handlePointer', () => {
    it('should call dispatchPointer for middle mouse (isMiddlePointerInput true)', () => {
      const { navigator, dispatchPointer } = createFakeNavigator()
      const { handlePointer } = useCanvasInput(navigator)
      // buttons=4 means middle mouse is held; button=-1 is not a middle button press
      const event = createMockPointerEvent({ buttons: 4 })
      handlePointer(event)
      expect(dispatchPointer).toHaveBeenCalledTimes(1)
    })

    it('should call dispatchPointer and preventDefault+stopPropagation for buttons=1 + isReadOnly=true', () => {
      const { navigator, dispatchPointer } = createFakeNavigator({
        readOnly: true
      })
      const { handlePointer } = useCanvasInput(navigator)
      const event = createMockPointerEvent({ buttons: 1 })
      handlePointer(event)
      expect(dispatchPointer).toHaveBeenCalledTimes(1)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
    })

    it('should NOT call dispatchPointer for buttons=1 + isReadOnly=false', () => {
      const { navigator, dispatchPointer } = createFakeNavigator({
        readOnly: false
      })
      const { handlePointer } = useCanvasInput(navigator)
      const event = createMockPointerEvent({ buttons: 1 })
      handlePointer(event)
      expect(dispatchPointer).not.toHaveBeenCalled()
    })

    it('should call dispatchPointer for buttons=4 (middle mouse hold)', () => {
      const { navigator, dispatchPointer } = createFakeNavigator({
        readOnly: false
      })
      const { handlePointer } = useCanvasInput(navigator)
      const event = createMockPointerEvent({ buttons: 4 })
      handlePointer(event)
      expect(dispatchPointer).toHaveBeenCalledTimes(1)
    })
  })

  describe('forwardEvent', () => {
    it('should reconstruct WheelEvent preserving deltaX and deltaY before dispatching', () => {
      const { navigator, dispatchWheel } = createFakeNavigator({
        standard: false
      })
      const { forwardEvent } = useCanvasInput(navigator)

      // Use a real WheelEvent so instanceof check passes; happy-dom supports delta fields.
      const originalEvent = new WheelEvent('wheel', { deltaX: 5, deltaY: 20 })
      forwardEvent(originalEvent)

      expect(dispatchWheel).toHaveBeenCalledTimes(1)
      const dispatched = dispatchWheel.mock.calls[0][0] as WheelEvent
      expect(dispatched.constructor.name).toBe('WheelEvent')
      expect(dispatched.deltaX).toBe(5)
      expect(dispatched.deltaY).toBe(20)
    })

    it('should call dispatchPointer for PointerEvent and preserve event type', () => {
      const { navigator, dispatchPointer } = createFakeNavigator()
      const { forwardEvent } = useCanvasInput(navigator)
      const event = new PointerEvent('pointermove', { buttons: 1 })
      forwardEvent(event)
      expect(dispatchPointer).toHaveBeenCalledTimes(1)
      expect(dispatchPointer.mock.calls[0][0]).toBeInstanceOf(PointerEvent)
    })

    it('should call dispatchPointer for MouseEvent and preserve event type', () => {
      const { navigator, dispatchPointer } = createFakeNavigator()
      const { forwardEvent } = useCanvasInput(navigator)
      const event = new MouseEvent('mousedown', { buttons: 1 })
      forwardEvent(event)
      expect(dispatchPointer).toHaveBeenCalledTimes(1)
      expect(dispatchPointer.mock.calls[0][0]).toBeInstanceOf(MouseEvent)
    })
  })
})
