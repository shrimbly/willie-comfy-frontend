import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useMoshpitCurationStore } from '../stores/moshpitCurationStore'
import { useMoshpitMetadataStore } from '../stores/moshpitMetadataStore'
import type { NormalizedParams } from '../services/paramNormalize'
import type { ParamKey } from '../services/filterTypes'
import { useMoshpitParamValueOptions } from './useMoshpitParamValueOptions'

function makeParams(overrides: Partial<NormalizedParams> = {}): NormalizedParams {
  return {
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
    workflowFingerprint: 'test',
    workflowFilename: null,
    saveNodeIdentity: null,
    ...overrides
  }
}

describe('useMoshpitParamValueOptions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns empty options when param is null', () => {
    const { options, resolutionPairs } = useMoshpitParamValueOptions(null)
    expect(options.value).toEqual([])
    expect(resolutionPairs.value).toEqual([])
  })

  it('derives sampler values sorted by descending count then alpha', () => {
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams('hash1', makeParams({ sampler: 'euler' }))
    metaStore.setParams('hash2', makeParams({ sampler: 'euler' }))
    metaStore.setParams('hash3', makeParams({ sampler: 'dpmpp_2m' }))

    const { options } = useMoshpitParamValueOptions('sampler')
    expect(options.value).toHaveLength(2)
    expect(options.value[0]).toEqual({ value: 'euler', count: 2 })
    expect(options.value[1]).toEqual({ value: 'dpmpp_2m', count: 1 })
  })

  it('derives one option per unique LoRA name from loras arrays', () => {
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams(
      'hash1',
      makeParams({ loras: [{ name: 'detail_tweaker', weight: 0.7 }] })
    )
    metaStore.setParams(
      'hash2',
      makeParams({
        loras: [
          { name: 'detail_tweaker', weight: 0.5 },
          { name: 'style_lora', weight: 1.0 }
        ]
      })
    )

    const { options } = useMoshpitParamValueOptions('loras')
    const values = options.value.map((o) => o.value)
    expect(values).toContain('detail_tweaker')
    expect(values).toContain('style_lora')
    // detail_tweaker appears in 2 assets; style_lora in 1
    const detailOpt = options.value.find((o) => o.value === 'detail_tweaker')
    expect(detailOpt?.count).toBe(2)
  })

  it('derives tag options from curationStore entries', () => {
    const metaStore = useMoshpitMetadataStore()
    const curationStore = useMoshpitCurationStore()

    metaStore.setParams('hash1', makeParams())
    metaStore.setParams('hash2', makeParams())

    curationStore.load({
      contentHash: 'hash1',
      metadata: {},
      curation: {
        favourite: false,
        tags: ['landscape', 'blue'],
        folders: [],
        hidden: false
      },
      params: makeParams()
    })
    curationStore.load({
      contentHash: 'hash2',
      metadata: {},
      curation: {
        favourite: false,
        tags: ['landscape'],
        folders: [],
        hidden: false
      },
      params: makeParams()
    })

    const { options } = useMoshpitParamValueOptions('tags')
    const landscapeOpt = options.value.find((o) => o.value === 'landscape')
    const blueOpt = options.value.find((o) => o.value === 'blue')

    expect(landscapeOpt?.count).toBe(2)
    expect(blueOpt?.count).toBe(1)
    // landscape appears first (higher count)
    expect(options.value[0].value).toBe('landscape')
  })

  it('returns resolutionPairs for param "resolution" with unique pairs', () => {
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams('hash1', makeParams({ width: 512, height: 512 }))
    metaStore.setParams('hash2', makeParams({ width: 512, height: 512 }))
    metaStore.setParams('hash3', makeParams({ width: 768, height: 768 }))

    const { options, resolutionPairs } = useMoshpitParamValueOptions('resolution')
    // options is empty for resolution (not categorical)
    expect(options.value).toEqual([])
    // 2 unique pairs
    expect(resolutionPairs.value).toHaveLength(2)
    const pairs = resolutionPairs.value.map(([w, h]) => `${w}x${h}`)
    expect(pairs).toContain('512x512')
    expect(pairs).toContain('768x768')
  })

  it('returns empty options for numeric param "cfg"', () => {
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams('hash1', makeParams({ cfg: 7.0 }))
    metaStore.setParams('hash2', makeParams({ cfg: 8.0 }))

    const { options } = useMoshpitParamValueOptions('cfg')
    expect(options.value).toEqual([])
  })

  it('reactively re-derives when the param source changes', () => {
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams('hash1', makeParams({ sampler: 'euler', model: 'sd15.ckpt' }))

    const param = ref<ParamKey | null>('sampler')
    const { options } = useMoshpitParamValueOptions(param)

    expect(options.value[0]?.value).toBe('euler')

    param.value = 'model'
    expect(options.value[0]?.value).toBe('sd15.ckpt')

    param.value = null
    expect(options.value).toEqual([])
  })
})
