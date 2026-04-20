import { useMagicKeys } from '@vueuse/core'
import type { Viewport } from 'pixi-viewport'
import { onBeforeUnmount, watch } from 'vue'

import type { CanvasInputNavigator } from '@/composables/canvas/useCanvasInput'
import { useCanvasInput } from '@/composables/canvas/useCanvasInput'

export function useMoshpitCanvasInput(
  viewport: Viewport,
  containerEl: HTMLElement
) {
  const keys = useMagicKeys()
  const spaceHeld = keys.space

  // TODO(phase-N): once pixi-viewport is replaced with our own navigator-driven
  // input pipeline, route real wheel/pointer events through these dispatchers.
  // For now pixi-viewport's drag()/wheel() plugins own input, so the navigator
  // is a no-op stub kept for API symmetry with the litegraph canvas path.
  const navigator: CanvasInputNavigator = {
    isStandardNavMode: () => true,
    isReadOnly: () => spaceHeld.value,
    dispatchWheel: () => {},
    dispatchPointer: () => {}
  }

  const api = useCanvasInput(navigator)

  // Space+drag: dynamically reconfigure the drag plugin so left-mouse pans while Space held (Pitfall 4)
  const stopWatch = watch(
    () => spaceHeld.value,
    (held) => {
      viewport.plugins.remove('drag')
      viewport.drag({ mouseButtons: held ? 'all' : 'middle' })
    }
  )

  // Prevent default browser Space scroll (Pitfall 4)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && document.activeElement === containerEl) {
      e.preventDefault()
    }
  }
  containerEl.addEventListener('keydown', onKeyDown)

  onBeforeUnmount(() => {
    stopWatch()
    containerEl.removeEventListener('keydown', onKeyDown)
  })

  return api
}
