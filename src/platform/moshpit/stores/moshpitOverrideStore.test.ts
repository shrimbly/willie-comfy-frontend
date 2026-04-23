import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/overrideRepository', () => ({
  loadAllOverrides: vi.fn(),
  saveOverride: vi.fn(),
  deleteOverride: vi.fn(),
  clearAllOverrides: vi.fn()
}))

import {
  clearAllOverrides,
  deleteOverride,
  loadAllOverrides,
  saveOverride
} from '../services/overrideRepository'
import { useMoshpitOverrideStore } from './moshpitOverrideStore'

const mockedLoad = vi.mocked(loadAllOverrides)
const mockedSave = vi.mocked(saveOverride)
const mockedDelete = vi.mocked(deleteOverride)
const mockedClearAll = vi.mocked(clearAllOverrides)

describe('moshpitOverrideStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedLoad.mockReset()
    mockedSave.mockReset()
    mockedDelete.mockReset()
    mockedClearAll.mockReset()
    mockedLoad.mockResolvedValue([])
    mockedSave.mockResolvedValue()
    mockedDelete.mockResolvedValue()
    mockedClearAll.mockResolvedValue()
  })

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

describe('moshpitOverrideStore persistence wiring', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedLoad.mockReset()
    mockedSave.mockReset()
    mockedDelete.mockReset()
    mockedClearAll.mockReset()
    mockedLoad.mockResolvedValue([])
    mockedSave.mockResolvedValue()
    mockedDelete.mockResolvedValue()
    mockedClearAll.mockResolvedValue()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('setPin triggers exactly one saveOverride after the debounce window', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 10, y: 20 })
    expect(mockedSave).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(mockedSave).toHaveBeenCalledTimes(1)
    const call = mockedSave.mock.calls[0][0]
    expect(call.contentHash).toBe('a')
    expect(call.pinnedWorldPos).toEqual({ x: 10, y: 20 })
    expect(call.scale).toBeUndefined()
    expect(typeof call.pinnedAt).toBe('number')
  })

  it('rapid successive setPin calls coalesce into a single saveOverride', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 1, y: 1 })
    vi.advanceTimersByTime(30)
    store.setPin('a', { x: 2, y: 2 })
    vi.advanceTimersByTime(30)
    store.setPin('a', { x: 3, y: 3 })
    expect(mockedSave).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(mockedSave).toHaveBeenCalledTimes(1)
    expect(mockedSave.mock.calls[0][0].pinnedWorldPos).toEqual({ x: 3, y: 3 })
  })

  it('setScale triggers saveOverride after debounce', () => {
    const store = useMoshpitOverrideStore()
    store.setScale('a', 1.5)
    vi.advanceTimersByTime(100)
    expect(mockedSave).toHaveBeenCalledTimes(1)
    const rec = mockedSave.mock.calls[0][0]
    expect(rec.scale).toBe(1.5)
    expect(rec.pinnedWorldPos).toBeUndefined()
  })

  it('setPin then unpin (no scale remaining) emits deleteOverride and no residual saveOverride', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 1, y: 1 })
    store.unpin('a')
    vi.advanceTimersByTime(100)
    expect(mockedSave).not.toHaveBeenCalled()
    expect(mockedDelete).toHaveBeenCalledTimes(1)
    expect(mockedDelete).toHaveBeenCalledWith('a')
  })

  it('setPin then setScale then unpin (scale remains) ends with saveOverride containing only scale', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 1, y: 1 })
    store.setScale('a', 2)
    store.unpin('a')
    vi.advanceTimersByTime(100)
    expect(mockedDelete).not.toHaveBeenCalled()
    expect(mockedSave).toHaveBeenCalledTimes(1)
    const rec = mockedSave.mock.calls[0][0]
    expect(rec.scale).toBe(2)
    expect(rec.pinnedWorldPos).toBeUndefined()
  })

  it('clearScale when a pin remains results in saveOverride without scale', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 5, y: 6 })
    store.setScale('a', 3)
    store.clearScale('a')
    vi.advanceTimersByTime(100)
    expect(mockedSave).toHaveBeenCalledTimes(1)
    const rec = mockedSave.mock.calls[0][0]
    expect(rec.pinnedWorldPos).toEqual({ x: 5, y: 6 })
    expect(rec.scale).toBeUndefined()
  })

  it('clearScale when nothing remains results in deleteOverride', () => {
    const store = useMoshpitOverrideStore()
    store.setScale('a', 2)
    store.clearScale('a')
    vi.advanceTimersByTime(100)
    expect(mockedSave).not.toHaveBeenCalled()
    expect(mockedDelete).toHaveBeenCalledWith('a')
  })

  it('clear(hash) schedules deleteOverride regardless of prior state', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 1, y: 1 })
    store.setScale('a', 2)
    store.clear('a')
    vi.advanceTimersByTime(100)
    expect(mockedSave).not.toHaveBeenCalled()
    expect(mockedDelete).toHaveBeenCalledWith('a')
  })

  it('clearAll cancels pending per-hash writes and fires clearAllOverrides once', () => {
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 1, y: 1 })
    store.setScale('b', 2)
    store.clearAll()
    vi.advanceTimersByTime(100)
    expect(mockedSave).not.toHaveBeenCalled()
    expect(mockedDelete).not.toHaveBeenCalled()
    expect(mockedClearAll).toHaveBeenCalledTimes(1)
  })

  it('hydrate() seeds the Map from loadAllOverrides', async () => {
    mockedLoad.mockResolvedValueOnce([
      {
        contentHash: 'a',
        pinnedWorldPos: { x: 1, y: 2 },
        pinnedAt: 123
      },
      {
        contentHash: 'b',
        scale: 2.5,
        pinnedAt: 456
      }
    ])
    const store = useMoshpitOverrideStore()
    await store.hydrate()
    expect(store.get('a')?.pinnedWorldPos).toEqual({ x: 1, y: 2 })
    expect(store.isPinned('a')).toBe(true)
    expect(store.get('b')?.scale).toBe(2.5)
    expect(store.size).toBe(2)
  })

  it('hydrate() failure leaves the store empty and swallows the error', async () => {
    mockedLoad.mockRejectedValueOnce(new Error('idb exploded'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = useMoshpitOverrideStore()
    await expect(store.hydrate()).resolves.toBeUndefined()
    expect(store.size).toBe(0)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('saveOverride rejection is caught and leaves in-memory state unchanged', async () => {
    mockedSave.mockRejectedValueOnce(new Error('write failed'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = useMoshpitOverrideStore()
    store.setPin('a', { x: 1, y: 2 })
    vi.advanceTimersByTime(100)
    // Let the rejected promise settle
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalled()
    })
    expect(store.get('a')?.pinnedWorldPos).toEqual({ x: 1, y: 2 })
    warnSpy.mockRestore()
  })
})
