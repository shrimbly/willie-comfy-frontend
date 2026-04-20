import type { InjectionKey, Ref } from 'vue'
import { inject } from 'vue'
import type { Viewport } from 'pixi-viewport'

/**
 * Shared reactive viewport reference between MoshpitCanvas (provider) and any
 * overlay components that need world-to-screen transforms (consumers).
 *
 * The value is a `Ref<Viewport | null>` — null until `Application.init()`
 * completes inside MoshpitCanvas's onMounted. Consumers must handle null.
 */
export const MOSHPIT_VIEWPORT_INJECTION_KEY: InjectionKey<Ref<Viewport | null>> =
  Symbol('moshpit:viewport')

export function useMoshpitViewport(): Ref<Viewport | null> {
  const ref = inject(MOSHPIT_VIEWPORT_INJECTION_KEY)
  if (!ref) {
    throw new Error(
      'useMoshpitViewport requires MOSHPIT_VIEWPORT_INJECTION_KEY to be provided by MoshpitCanvas'
    )
  }
  return ref
}
