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
export const MOSHPIT_VIEWPORT_INJECTION_KEY: InjectionKey<
  Ref<Viewport | null>
> = Symbol('moshpit:viewport')

export function useMoshpitViewport(): Ref<Viewport | null> {
  const ref = inject(MOSHPIT_VIEWPORT_INJECTION_KEY)
  if (!ref) {
    throw new Error(
      'useMoshpitViewport requires MOSHPIT_VIEWPORT_INJECTION_KEY to be provided by MoshpitCanvas'
    )
  }
  return ref
}

/**
 * World-space AABB used for sprite hit-testing. Matches the marquee's convention
 * (min on left/top, max on right/bottom) but in world coords.
 */
export interface SpriteHitRect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/**
 * Hit-test API exposed by the sprite layer. Populated by MoshpitCanvas once the
 * sprite layer mounts. Consumers (selection gestures) must handle null while
 * the canvas is still bootstrapping.
 */
export interface SpriteHitTester {
  /** Returns the top-most asset hash whose sprite AABB contains the world point, or null. */
  hitTestPoint(worldX: number, worldY: number): string | null
  /** Returns every asset hash whose sprite AABB intersects the world rect. */
  hitTestRect(rect: SpriteHitRect): string[]
  /**
   * Returns the sprite's current rendered world position for `hash`, or null
   * when the hash has no mounted sprite (filtered out, not yet loaded, or
   * destroyed). The value tracks pin overrides because the sprite-layer
   * watchEffect writes override-resolved coords into the sprite entry.
   */
  getSpriteWorldPos(hash: string): { x: number; y: number } | null
}

export const MOSHPIT_SPRITE_HITTEST_INJECTION_KEY: InjectionKey<
  Ref<SpriteHitTester | null>
> = Symbol('moshpit:sprite-hittest')
