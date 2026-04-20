import { useMagicKeys } from '@vueuse/core'
import type { Viewport } from 'pixi-viewport'
import { onBeforeUnmount, watch } from 'vue'

/**
 * Space+drag pan + Space-scroll prevention for the Moshpit PixiJS canvas.
 *
 * Why this composable exists (and why it doesn't touch `useCanvasInput`):
 *
 * Moshpit pan/zoom parity with the litegraph canvas (SHELL-03) is achieved
 * via pixi-viewport plugin configuration equivalence — middle-mouse drag,
 * wheel zoom, pinch, and decelerate are all owned by pixi-viewport's
 * built-in plugins configured in `MoshpitCanvas.vue`. The shared
 * `useCanvasInput` composable at `src/composables/canvas/useCanvasInput.ts`
 * is consumed by the litegraph adapter (`useCanvasInteractions`) and is
 * not in the Moshpit input path in Phase 1.
 *
 * The one behavior pixi-viewport does not provide is Space-held left-mouse
 * panning (pixi-viewport's drag plugin is bound to a single mouse-button
 * mode at a time, not conditional on a modifier key). This composable owns
 * that by watching `useMagicKeys().space` and reconfiguring the drag plugin
 * between `'middle'` and `'all'`.
 *
 * If / when pixi-viewport is replaced with a custom navigator driven by
 * `useCanvasInput` dispatch, this composable becomes the anchor for that
 * reroute. Until then, keeping the surface minimal (void return, no
 * navigator stub) avoids the dead-API smell flagged by WR-05.
 */
export function useMoshpitSpacePan(
  viewport: Viewport,
  containerEl: HTMLElement
): void {
  const keys = useMagicKeys()
  const spaceHeld = keys.space

  const stopWatch = watch(
    () => spaceHeld.value,
    (held) => {
      viewport.plugins.remove('drag')
      viewport.drag({ mouseButtons: held ? 'all' : 'middle' })
    }
  )

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
}
