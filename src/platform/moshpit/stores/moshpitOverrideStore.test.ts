import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useMoshpitOverrideStore } from './moshpitOverrideStore'

describe('moshpitOverrideStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('has empty initial state', () => {
    const store = useMoshpitOverrideStore()
    expect(store.size).toBe(0)
    expect(store.get('missing')).toBeUndefined()
    expect(store.isPinned('missing')).toBe(false)
  })

  it('setPin creates a record with pinnedWorldPos and increments size', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 500, y: 300 })
    const record = store.get('a')
    expect(record?.pinnedWorldPos).toEqual({ x: 500, y: 300 })
    expect(store.isPinned('a')).toBe(true)
    expect(store.size).toBe(1)
  })

  it('setPin defensively copies the position payload', () => {
    const store = useMoshpitOverrideStore()
    const source = { x: 1, y: 2 }
    store.setPin('a', source)
    source.x = 999
    expect(store.get('a')?.pinnedWorldPos).toEqual({ x: 1, y: 2 })
  })

  it('setPin on an existing record preserves scale', () => {
    const store = useMoshpitOverrideStore()
    store.setScale('a', 1.5)
    store.setPin('a', { x: 10, y: 20 })
    const record = store.get('a')
    expect(record?.scale).toBe(1.5)
    expect(record?.pinnedWorldPos).toEqual({ x: 10, y: 20 })
  })

  it('setPin refreshes pinnedAt (monotonic non-decreasing)', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 0, y: 0 })
    const first = store.get('a')?.pinnedAt ?? 0
    store.setPin('a', { x: 1, y: 1 })
    const second = store.get('a')?.pinnedAt ?? 0
    expect(second).toBeGreaterThanOrEqual(first)
  })

  it('setScale creates a record without pinnedWorldPos; isPinned stays false', () => {
    const store = useMoshpitOverrideStore()
    store.setScale('a', 1.5)
    const record = store.get('a')
    expect(record?.scale).toBe(1.5)
    expect(record?.pinnedWorldPos).toBeUndefined()
    expect(store.isPinned('a')).toBe(false)
    expect(store.size).toBe(1)
  })

  it('setScale on an existing pinned record preserves pinnedWorldPos', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 5, y: 6 })
    store.setScale('a', 2)
    const record = store.get('a')
    expect(record?.pinnedWorldPos).toEqual({ x: 5, y: 6 })
    expect(record?.scale).toBe(2)
  })

  it('unpin removes pinnedWorldPos but keeps the record if scale is set', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 1, y: 2 })
    store.setScale('a', 1.25)
    store.unpin('a')
    const record = store.get('a')
    expect(record?.pinnedWorldPos).toBeUndefined()
    expect(record?.scale).toBe(1.25)
    expect(store.size).toBe(1)
  })

  it('unpin removes the record entirely when only pin existed', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 1, y: 2 })
    store.unpin('a')
    expect(store.get('a')).toBeUndefined()
    expect(store.size).toBe(0)
  })

  it('unpin is a no-op for unknown hash', () => {
    const store = useMoshpitOverrideStore()
    expect(() => store.unpin('missing')).not.toThrow()
    expect(store.size).toBe(0)
  })

  it('clearScale removes scale but keeps pinnedWorldPos', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 3, y: 4 })
    store.setScale('a', 2)
    store.clearScale('a')
    const record = store.get('a')
    expect(record?.scale).toBeUndefined()
    expect(record?.pinnedWorldPos).toEqual({ x: 3, y: 4 })
  })

  it('clearScale removes record entirely when only scale existed', () => {
    const store = useMoshpitOverrideStore()
    store.setScale('a', 1.5)
    store.clearScale('a')
    expect(store.get('a')).toBeUndefined()
    expect(store.size).toBe(0)
  })

  it('clear removes the whole record regardless of contents', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 1, y: 2 })
    store.setScale('a', 2)
    store.clear('a')
    expect(store.get('a')).toBeUndefined()
    expect(store.size).toBe(0)
  })

  it('clearAll empties the map', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 1, y: 2 })
    store.setScale('b', 2)
    store.clearAll()
    expect(store.size).toBe(0)
    expect(store.get('a')).toBeUndefined()
    expect(store.get('b')).toBeUndefined()
  })

  it('reset aliases clearAll', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 1, y: 2 })
    store.reset()
    expect(store.size).toBe(0)
  })

  it('mutations swap the underlying Map reference so watchers re-fire', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 0, y: 0 })
    const before = store.$state.records
    store.setScale('a', 2)
    const afterScale = store.$state.records
    store.unpin('a')
    const afterUnpin = store.$state.records
    store.clear('a')
    const afterClear = store.$state.records
    expect(afterScale).not.toBe(before)
    expect(afterUnpin).not.toBe(afterScale)
    expect(afterClear).not.toBe(afterUnpin)
  })
})
