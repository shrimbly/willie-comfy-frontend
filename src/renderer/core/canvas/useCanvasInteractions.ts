import { computed } from 'vue'

import type { CanvasInputNavigator } from '@/composables/canvas/useCanvasInput'
import { useCanvasInput } from '@/composables/canvas/useCanvasInput'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'

/**
 * Thin litegraph adapter over the pure `useCanvasInput` composable.
 * Wires navigator callbacks to the LiteGraph canvas element and app/store state.
 * All pan/zoom/marquee math lives in `useCanvasInput`.
 */
export function useCanvasInteractions() {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()

  /**
   * Whether Vue node components should handle pointer events.
   * Returns false when canvas is in read-only/panning mode (e.g., space key held).
   */
  const shouldHandleNodePointerEvents = computed(
    () => !(canvasStore.canvas?.read_only ?? false)
  )

  const navigator: CanvasInputNavigator = {
    isStandardNavMode: () =>
      settingStore.get('Comfy.Canvas.NavigationMode') === 'standard',
    isReadOnly: () => canvasStore.getCanvas()?.read_only ?? false,
    dispatchWheel: (event) => {
      const canvasEl = app.canvas?.canvas
      if (!canvasEl) return
      const { clientX, clientY, deltaX, deltaY, ctrlKey, metaKey, shiftKey } =
        event
      canvasEl.dispatchEvent(
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
    },
    dispatchPointer: (event) => {
      const canvasEl = app.canvas?.canvas
      if (!canvasEl) return
      const EventConstructor = event.constructor as
        | typeof MouseEvent
        | typeof PointerEvent
      canvasEl.dispatchEvent(new EventConstructor(event.type, event))
    }
  }

  const { handleWheel, handlePointer, forwardEvent } = useCanvasInput(navigator)

  return {
    handleWheel,
    handlePointer,
    forwardEventToCanvas: forwardEvent,
    shouldHandleNodePointerEvents
  }
}
