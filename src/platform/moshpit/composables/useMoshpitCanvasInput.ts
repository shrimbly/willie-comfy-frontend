import { useMagicKeys } from '@vueuse/core'
import type { Viewport } from 'pixi-viewport'
import { onBeforeUnmount, watch } from 'vue'

import type { CanvasInputNavigator } from '@/composables/canvas/useCanvasInput'
import { useCanvasInput } from '@/composables/canvas/useCanvasInput'

export function useMoshpitCanvasInput(viewport: Viewport, containerEl: HTMLElement) {
  const keys = useMagicKeys()
  const spaceHeld = keys.space

  const navigator: CanvasInputNavigator = {
    isStandardNavMode: () => true,
    isReadOnly: () => spaceHeld.value ?? false,
    dispatchWheel: () => {
      // pixi-viewport handles wheel directly via its wheel() plugin; nothing to forward.
    },
    dispatchPointer: () => {
      // pixi-viewport handles pointer directly via its drag() plugin; nothing to forward.
    }
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
