import { isMiddlePointerInput } from '@/base/pointerUtils'

export interface CanvasInputNavigator {
  /** Returns true when standard nav mode is active (Ctrl+wheel zooms). False = legacy (plain wheel zooms). */
  readonly isStandardNavMode: () => boolean
  /** Returns true when the host canvas is in read-only / Space-held pan mode. */
  readonly isReadOnly: () => boolean
  /** Dispatch a reconstructed wheel event to the host canvas. */
  readonly dispatchWheel: (event: WheelEvent) => void
  /** Dispatch a reconstructed pointer/mouse event to the host canvas. */
  readonly dispatchPointer: (event: PointerEvent | MouseEvent) => void
}

/**
 * Pure pan/zoom/marquee input composable. Contains no litegraph imports.
 * Adapters supply a `CanvasInputNavigator` to wire the math to a concrete canvas.
 */
export function useCanvasInput(navigator: CanvasInputNavigator): {
  handleWheel: (event: WheelEvent) => void
  handlePointer: (event: PointerEvent) => void
  forwardEvent: (event: WheelEvent | PointerEvent | MouseEvent) => void
} {
  /**
   * Returns true if the wheel event target is inside a focused capture-wheel element.
   * Two-finger panning continues over unfocused inputs; once focused the widget owns scroll.
   */
  function wheelCapturedByFocusedElement(event: WheelEvent): boolean {
    const target = event.target as HTMLElement | null
    const captureElement = target?.closest('[data-capture-wheel="true"]')
    const active = document.activeElement as Element | null
    return !!(captureElement && active && captureElement.contains(active))
  }

  function shouldForwardWheelEvent(event: WheelEvent): boolean {
    return (
      !wheelCapturedByFocusedElement(event) ||
      (navigator.isStandardNavMode() && (event.ctrlKey || event.metaKey))
    )
  }

  function forwardEvent(
    event: WheelEvent | PointerEvent | MouseEvent
  ): void {
    if (event.type === 'wheel' && !shouldForwardWheelEvent(event as WheelEvent))
      return

    event.preventDefault()
    event.stopPropagation()

    if (event.type === 'wheel') {
      const {
        clientX,
        clientY,
        deltaX,
        deltaY,
        ctrlKey,
        metaKey,
        shiftKey
      } = event as WheelEvent
      navigator.dispatchWheel(
        new WheelEvent('wheel', {
          clientX,
          clientY,
          deltaX,
          deltaY,
          ctrlKey,
          metaKey,
          shiftKey
        })
      )
      return
    }

    navigator.dispatchPointer(event as PointerEvent | MouseEvent)
  }

  function handleWheel(event: WheelEvent): void {
    if (!shouldForwardWheelEvent(event)) return

    if (navigator.isStandardNavMode() && (event.ctrlKey || event.metaKey)) {
      forwardEvent(event)
      return
    }

    if (!navigator.isStandardNavMode()) {
      forwardEvent(event)
      return
    }
  }

  function handlePointer(event: PointerEvent): void {
    if (isMiddlePointerInput(event)) {
      forwardEvent(event)
      return
    }

    const isSpacePanningDrag = navigator.isReadOnly() && event.buttons === 1
    const isMiddleMousePanning = event.buttons === 4

    if (isSpacePanningDrag || isMiddleMousePanning) {
      event.preventDefault()
      event.stopPropagation()
      forwardEvent(event)
      return
    }
  }

  return { handleWheel, handlePointer, forwardEvent }
}
