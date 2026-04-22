/**
 * Phase 5 Plan 03 — Tournament keybindings composable (D-13 / D-16).
 *
 * Attaches a capture-phase keydown listener to `window` and routes the full
 * tournament keymap to `useMoshpitTournamentStore` actions:
 *
 *   ArrowLeft  -> pickWinner('A')
 *   ArrowRight -> pickWinner('B')
 *   ArrowDown  -> skip()
 *   Space      -> toggleFlip()
 *   [          -> cycleDisplayMode(-1)
 *   ]          -> cycleDisplayMode(+1)
 *   m / M      -> togglePeek()
 *   ,          -> nudgeWipe(event.shiftKey ? -0.2 : -0.05)
 *   .          -> nudgeWipe(event.shiftKey ? +0.2 : +0.05)
 *   /          -> resetWipe()
 *
 * Esc is intentionally NOT routed here — it's handled by Reka DialogContent's
 * @escape-key-down so the focus-trap / aria-modal lifecycle stays intact.
 *
 * Window-scope (capture phase) is used instead of a DialogContent template ref
 * because Reka's `<Primitive>` exposes a component instance, not an HTMLElement,
 * so a scoped listener silently attaches to nothing. The handler is a no-op
 * unless `store.isActive` is true, so non-modal keystrokes pass through freely.
 *
 * Every handled key calls preventDefault() + stopPropagation() so canvas
 * shortcuts (F / Z / Cmd+A / Space-pan) never fire behind the overlay.
 */
import { useEventListener } from '@vueuse/core'

import { useMoshpitTournamentStore } from '../stores/moshpitTournamentStore'

export function useMoshpitTournamentKeybindings(): void {
  const store = useMoshpitTournamentStore()

  function onKeydown(e: KeyboardEvent): void {
    if (!store.isActive) return
    let handled = true
    switch (e.key) {
      case 'ArrowLeft':
        store.pickWinner('A')
        break
      case 'ArrowRight':
        store.pickWinner('B')
        break
      case 'ArrowDown':
        store.skip()
        break
      case ' ':
        store.toggleFlip()
        break
      case '[':
        store.cycleDisplayMode(-1)
        break
      case ']':
        store.cycleDisplayMode(1)
        break
      case 'm':
      case 'M':
        store.togglePeek()
        break
      case ',':
        store.nudgeWipe(e.shiftKey ? -0.2 : -0.05)
        break
      case '.':
        store.nudgeWipe(e.shiftKey ? 0.2 : 0.05)
        break
      case '/':
        store.resetWipe()
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  useEventListener(() => window, 'keydown', onKeydown, { capture: true })
}
