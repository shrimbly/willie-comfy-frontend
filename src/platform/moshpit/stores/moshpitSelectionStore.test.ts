import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useMoshpitSelectionStore } from './moshpitSelectionStore'

describe('moshpitSelectionStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('has correct initial state', () => {
    const store = useMoshpitSelectionStore()
    expect(store.selected).toEqual([])
    expect(store.size).toBe(0)
  })

  it('add and remove change selection membership', () => {
    const store = useMoshpitSelectionStore()
    store.add('a')
    expect(store.isSelected('a')).toBe(true)
    expect(store.size).toBe(1)
    store.remove('a')
    expect(store.isSelected('a')).toBe(false)
    expect(store.size).toBe(0)
  })

  it('toggle flips membership', () => {
    const store = useMoshpitSelectionStore()
    store.toggle('x')
    expect(store.isSelected('x')).toBe(true)
    store.toggle('x')
    expect(store.isSelected('x')).toBe(false)
  })

  it('addMany unions with existing selection', () => {
    const store = useMoshpitSelectionStore()
    store.add('a')
    store.addMany(['b', 'c'])
    expect(store.selected.sort()).toEqual(['a', 'b', 'c'])
  })

  it('setSelection replaces the entire selection', () => {
    const store = useMoshpitSelectionStore()
    store.add('a')
    store.add('b')
    store.setSelection(['c', 'd'])
    expect(store.selected.sort()).toEqual(['c', 'd'])
    expect(store.isSelected('a')).toBe(false)
  })

  it('clear empties selection', () => {
    const store = useMoshpitSelectionStore()
    store.add('a')
    store.add('b')
    store.clear()
    expect(store.selected).toEqual([])
    expect(store.size).toBe(0)
  })

  it('selectAll copies given array into selection', () => {
    const store = useMoshpitSelectionStore()
    store.selectAll(['x', 'y', 'z'])
    expect(store.selected.sort()).toEqual(['x', 'y', 'z'])
  })

  it('selectAll with empty array works without throwing', () => {
    const store = useMoshpitSelectionStore()
    store.add('a')
    expect(() => store.selectAll([])).not.toThrow()
    expect(store.selected).toEqual([])
  })

  it('isSelected returns false for unknown id', () => {
    const store = useMoshpitSelectionStore()
    expect(store.isSelected('unknown')).toBe(false)
  })

  it('remove is no-op for unknown id', () => {
    const store = useMoshpitSelectionStore()
    store.add('a')
    expect(() => store.remove('unknown')).not.toThrow()
    expect(store.size).toBe(1)
  })
})
