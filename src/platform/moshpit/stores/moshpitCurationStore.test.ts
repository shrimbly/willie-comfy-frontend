import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useMoshpitCurationStore } from './moshpitCurationStore'

describe('moshpitCurationStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('load stores a CurationRecord by contentHash', () => {
    const store = useMoshpitCurationStore()
    store.load({
      contentHash: 'h1',
      metadata: {},
      curation: { favourite: true, tags: ['a'], folders: [], hidden: false }
    })
    expect(store.get('h1')?.favourite).toBe(true)
    expect(store.get('h1')?.tags).toEqual(['a'])
  })

  it('get returns undefined for unknown hash', () => {
    const store = useMoshpitCurationStore()
    expect(store.get('missing')).toBeUndefined()
  })

  it('reset clears the map', () => {
    const store = useMoshpitCurationStore()
    store.load({
      contentHash: 'h1',
      metadata: {},
      curation: { favourite: false, tags: [], folders: [], hidden: false }
    })
    store.reset()
    expect(store.get('h1')).toBeUndefined()
  })
})
