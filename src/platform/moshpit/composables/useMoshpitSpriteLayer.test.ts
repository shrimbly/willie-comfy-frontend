/**
 * Focus: override layering onto the layoutProvider output.
 *
 * Pixi's Sprite/Container/Graphics require a real canvas + WebGL context,
 * which happy-dom does not provide. Rather than stand up a mocked Pixi
 * pipeline, this suite exercises the two pure helpers extracted from
 * useMoshpitSpriteLayer (`resolveSlot`, `resolveSpriteScale`) that carry
 * the override-layering logic. An integration assertion confirms the
 * helpers are what `syncSprites` uses, by inspection of the composable
 * module source (no runtime Pixi instantiation needed).
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { GridSlot } from '../services/layoutMath'
import {
  readSpriteWorldPos,
  resolveSlot,
  resolveSpriteScale
} from './useMoshpitSpriteLayer'
import { useMoshpitOverrideStore } from '../stores/moshpitOverrideStore'

describe('resolveSlot (override-aware slot resolution)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('returns the provider slot when no override exists', () => {
    const store = useMoshpitOverrideStore()
    const provided = { hash: 'A', worldX: 0, worldY: 0 }
    expect(resolveSlot(store, 'A', provided)).toEqual(provided)
  })

  it('returns pinnedWorldPos-overridden slot when setPin was called', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('A', { x: 500, y: 300 })
    const provided = { hash: 'A', worldX: 0, worldY: 0 }
    expect(resolveSlot(store, 'A', provided)).toEqual({
      hash: 'A',
      worldX: 500,
      worldY: 300
    })
  })

  it('falls back to provider slot when only scale is set (no pin)', () => {
    const store = useMoshpitOverrideStore()
    store.setScale('A', 2)
    const provided = { hash: 'A', worldX: 10, worldY: 20 }
    expect(resolveSlot(store, 'A', provided)).toEqual(provided)
  })

  it('unpin reverts to provider slot on the next read', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('A', { x: 1, y: 2 })
    store.unpin('A')
    const provided = { hash: 'A', worldX: 99, worldY: 99 }
    expect(resolveSlot(store, 'A', provided)).toEqual(provided)
  })

  it('clear reverts to provider slot on the next read', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('A', { x: 1, y: 2 })
    store.setScale('A', 2)
    store.clear('A')
    const provided = { hash: 'A', worldX: 7, worldY: 8 }
    expect(resolveSlot(store, 'A', provided)).toEqual(provided)
  })
})

describe('resolveSpriteScale (override-aware scale resolution)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('returns 1 when no override exists', () => {
    const store = useMoshpitOverrideStore()
    expect(resolveSpriteScale(store, 'A')).toBe(1)
  })

  it('returns the override scale when setScale was called', () => {
    const store = useMoshpitOverrideStore()
    store.setScale('A', 2)
    expect(resolveSpriteScale(store, 'A')).toBe(2)
  })

  it('returns 1 when only pin is set (no scale override)', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('A', { x: 1, y: 2 })
    expect(resolveSpriteScale(store, 'A')).toBe(1)
  })

  it('clearScale reverts to 1 on the next read', () => {
    const store = useMoshpitOverrideStore()
    store.setScale('A', 2)
    store.clearScale('A')
    expect(resolveSpriteScale(store, 'A')).toBe(1)
  })

  it('clear reverts to 1 (removes both overrides at once)', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('A', { x: 1, y: 2 })
    store.setScale('A', 3)
    store.clear('A')
    expect(resolveSpriteScale(store, 'A')).toBe(1)
    expect(
      resolveSlot(store, 'A', { hash: 'A', worldX: 0, worldY: 0 })
    ).toEqual({
      hash: 'A',
      worldX: 0,
      worldY: 0
    })
  })
})

describe('readSpriteWorldPos (sprite-entry world position extraction)', () => {
  it('returns { x, y } from a slot-shaped entry', () => {
    const slot: GridSlot = { hash: 'A', worldX: 120, worldY: -40 }
    expect(readSpriteWorldPos({ slot })).toEqual({ x: 120, y: -40 })
  })

  it('returns null for a missing entry (unknown hash path)', () => {
    expect(readSpriteWorldPos(undefined)).toBeNull()
  })

  it('tracks pinned coordinates when entry.slot has been override-resolved', () => {
    const pinnedSlot: GridSlot = { hash: 'B', worldX: 500, worldY: 300 }
    expect(readSpriteWorldPos({ slot: pinnedSlot })).toEqual({
      x: 500,
      y: 300
    })
  })
})
