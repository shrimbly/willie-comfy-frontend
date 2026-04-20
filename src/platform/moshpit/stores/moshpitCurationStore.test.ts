import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { NormalizedParams } from '../services/paramNormalize'
import { useMoshpitCurationStore } from './moshpitCurationStore'

const stubParams: NormalizedParams = {
  model: undefined,
  loras: [],
  cfg: undefined,
  steps: undefined,
  sampler: undefined,
  scheduler: undefined,
  seed: undefined,
  positivePrompt: undefined,
  negativePrompt: undefined,
  width: undefined,
  height: undefined,
  timestamp: 0,
  workflowFingerprint: '',
  workflowFilename: null
}

describe('moshpitCurationStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('load stores a CurationRecord by contentHash', () => {
    const store = useMoshpitCurationStore()
    store.load({
      contentHash: 'h1',
      metadata: {},
      curation: { favourite: true, tags: ['a'], folders: [], hidden: false },
      params: stubParams
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
      curation: { favourite: false, tags: [], folders: [], hidden: false },
      params: stubParams
    })
    store.reset()
    expect(store.get('h1')).toBeUndefined()
  })
})
