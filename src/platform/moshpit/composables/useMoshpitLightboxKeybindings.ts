/**
 * Lightbox keybindings — window-level capture-phase handler, self-gated on
 * `lightboxStore.isOpen`. Mirrors `useMoshpitTournamentKeybindings` so the two
 * modal modes behave consistently.
 *
 *   ArrowLeft  -> prev()
 *   ArrowRight -> next()
 *
 * Esc is delegated to Reka DialogContent's @escape-key-down upstream so the
 * focus-trap / aria-modal lifecycle stays intact.
 */
import { useEventListener } from '@vueuse/core'

import { useMoshpitLightboxStore } from '../stores/moshpitLightboxStore'

export function useMoshpitLightboxKeybindings(): void {
  const store = useMoshpitLightboxStore()

  function onKeydown(e: KeyboardEvent): void {
    if (!store.isOpen) return
    if (!store.hasMultiple) return
    let handled = true
    switch (e.key) {
      case 'ArrowLeft':
        store.prev()
        break
      case 'ArrowRight':
        store.next()
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  useEventListener(window, 'keydown', onKeydown, { capture: true })
}
