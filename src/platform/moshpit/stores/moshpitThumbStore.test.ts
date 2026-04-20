import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMoshpitThumbStore } from './moshpitThumbStore'

describe('moshpitThumbStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('addThumb creates an object URL, getUrl returns it, has is true', () => {
    const createSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock/1')
    const store = useMoshpitThumbStore()
    const url = store.addThumb('h1', new Blob(['x']))
    expect(url).toBe('blob:mock/1')
    expect(store.getUrl('h1')).toBe('blob:mock/1')
    expect(store.has('h1')).toBe(true)
    createSpy.mockRestore()
  })

  it('adding twice for the same hash revokes the old URL', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:old')
      .mockReturnValueOnce('blob:new')
    const revokeSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    const store = useMoshpitThumbStore()
    store.addThumb('h1', new Blob(['a']))
    store.addThumb('h1', new Blob(['b']))
    expect(revokeSpy).toHaveBeenCalledWith('blob:old')
    expect(store.getUrl('h1')).toBe('blob:new')
    revokeSpy.mockRestore()
  })

  it('reset revokes every outstanding URL', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:a')
      .mockReturnValueOnce('blob:b')
    const revokeSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    const store = useMoshpitThumbStore()
    store.addThumb('h1', new Blob(['a']))
    store.addThumb('h2', new Blob(['b']))
    store.reset()
    expect(revokeSpy).toHaveBeenCalledWith('blob:a')
    expect(revokeSpy).toHaveBeenCalledWith('blob:b')
    expect(store.size).toBe(0)
    revokeSpy.mockRestore()
  })
})
