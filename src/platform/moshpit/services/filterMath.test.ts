import { describe, expect, it } from 'vitest'

import type { FilterChip, TimeRange } from './filterTypes'
import type { NormalizedParams } from './paramNormalize'
import type { CurationRecord } from './thumbRepository.types'
import {
  applyFilterChips,
  getDateRangeForPreset,
  matchesChip,
  matchesTimeRange
} from './filterMath'

// Fixed reference time for deterministic time-range tests (RESEARCH.md Pitfall 7)
const NOW_MS = 1_700_000_000_000

// --- Test factories ---

function params(overrides: Partial<NormalizedParams>): NormalizedParams {
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
    timestamp: NOW_MS,
    workflowFingerprint: undefined,
    ...overrides
  }
}

function curation(overrides: Partial<CurationRecord>): CurationRecord {
  return {
    favourite: false,
    tags: [],
    folders: [],
    hidden: false,
    ...overrides
  }
}

function chip(
  param: FilterChip['param'],
  value: FilterChip['value']
): FilterChip {
  return { id: 'test', param, value }
}

// --- matchesChip ---

describe('matchesChip', () => {
  describe('categorical (FILTER-02, FILTER-04)', () => {
    it('admits asset when model matches single-value chip', () => {
      const p = params({ model: 'sd_xl.safetensors' })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('model', { kind: 'categorical', values: ['sd_xl.safetensors'] })
        )
      ).toBe(true)
    })

    it('excludes asset when model does not match chip value', () => {
      const p = params({ model: 'other.safetensors' })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('model', { kind: 'categorical', values: ['sd_xl.safetensors'] })
        )
      ).toBe(false)
    })

    it('admits asset when model matches any value in multi-value chip (OR within chip)', () => {
      const p = params({ model: 'b.safetensors' })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('model', {
            kind: 'categorical',
            values: ['a.safetensors', 'b.safetensors']
          })
        )
      ).toBe(true)
    })

    it('admits asset with sampler matching one of multiple values (OR within chip)', () => {
      const p = params({ sampler: 'dpmpp_2m' })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('sampler', {
            kind: 'categorical',
            values: ['euler', 'dpmpp_2m']
          })
        )
      ).toBe(true)
    })

    it('excludes asset with sampler not matching any chip value', () => {
      const p = params({ sampler: 'ddim' })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('sampler', {
            kind: 'categorical',
            values: ['euler', 'dpmpp_2m']
          })
        )
      ).toBe(false)
    })
  })

  describe('loras — name-only match (FILTER-03)', () => {
    it('admits asset whose loras array contains the named LoRA (any weight)', () => {
      const p = params({
        loras: [{ name: 'style_x.safetensors', weight: 0.8 }]
      })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('loras', {
            kind: 'categorical',
            values: ['style_x.safetensors']
          })
        )
      ).toBe(true)
    })

    it('admits asset with different LoRA weight — weight is irrelevant (D-04)', () => {
      const p = params({
        loras: [{ name: 'style_x.safetensors', weight: 0.3 }]
      })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('loras', {
            kind: 'categorical',
            values: ['style_x.safetensors']
          })
        )
      ).toBe(true)
    })

    it('excludes asset when loras array is empty', () => {
      const p = params({ loras: [] })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('loras', {
            kind: 'categorical',
            values: ['style_x.safetensors']
          })
        )
      ).toBe(false)
    })

    it('excludes asset when loras array contains different LoRA names', () => {
      const p = params({
        loras: [{ name: 'other.safetensors', weight: 1.0 }]
      })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('loras', {
            kind: 'categorical',
            values: ['style_x.safetensors']
          })
        )
      ).toBe(false)
    })

    it('admits asset when any lora in array matches chip value (OR within chip)', () => {
      const p = params({
        loras: [
          { name: 'lora_a.safetensors', weight: 0.5 },
          { name: 'lora_b.safetensors', weight: 0.7 }
        ]
      })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('loras', {
            kind: 'categorical',
            values: ['lora_b.safetensors']
          })
        )
      ).toBe(true)
    })
  })

  describe('numeric range (FILTER-04)', () => {
    it('admits asset with cfg inside [min, max] range inclusive', () => {
      const p = params({ cfg: 7.0 })
      const c = curation({})
      expect(
        matchesChip(p, c, chip('cfg', { kind: 'numeric', min: 6, max: 8, exact: null }))
      ).toBe(true)
    })

    it('admits asset with cfg at the min boundary (inclusive)', () => {
      const p = params({ cfg: 6 })
      const c = curation({})
      expect(
        matchesChip(p, c, chip('cfg', { kind: 'numeric', min: 6, max: 8, exact: null }))
      ).toBe(true)
    })

    it('admits asset with cfg at the max boundary (inclusive)', () => {
      const p = params({ cfg: 8 })
      const c = curation({})
      expect(
        matchesChip(p, c, chip('cfg', { kind: 'numeric', min: 6, max: 8, exact: null }))
      ).toBe(true)
    })

    it('excludes asset with cfg below min', () => {
      const p = params({ cfg: 5.0 })
      const c = curation({})
      expect(
        matchesChip(p, c, chip('cfg', { kind: 'numeric', min: 6, max: 8, exact: null }))
      ).toBe(false)
    })

    it('excludes asset with cfg above max', () => {
      const p = params({ cfg: 9.0 })
      const c = curation({})
      expect(
        matchesChip(p, c, chip('cfg', { kind: 'numeric', min: 6, max: 8, exact: null }))
      ).toBe(false)
    })

    it('exact value match: admits only the exact value', () => {
      const p = params({ steps: 20 })
      const c = curation({})
      expect(
        matchesChip(p, c, chip('steps', { kind: 'numeric', min: null, max: null, exact: 20 }))
      ).toBe(true)
    })

    it('exact value match: excludes values adjacent to exact', () => {
      const c = curation({})
      expect(
        matchesChip(
          params({ steps: 19 }),
          c,
          chip('steps', { kind: 'numeric', min: null, max: null, exact: 20 })
        )
      ).toBe(false)
      expect(
        matchesChip(
          params({ steps: 21 }),
          c,
          chip('steps', { kind: 'numeric', min: null, max: null, exact: 20 })
        )
      ).toBe(false)
    })

    it('open upper bound (max=null): admits any value >= min', () => {
      const c = curation({})
      expect(
        matchesChip(
          params({ cfg: 10 }),
          c,
          chip('cfg', { kind: 'numeric', min: 10, max: null, exact: null })
        )
      ).toBe(true)
      expect(
        matchesChip(
          params({ cfg: 1000 }),
          c,
          chip('cfg', { kind: 'numeric', min: 10, max: null, exact: null })
        )
      ).toBe(true)
      expect(
        matchesChip(
          params({ cfg: 9 }),
          c,
          chip('cfg', { kind: 'numeric', min: 10, max: null, exact: null })
        )
      ).toBe(false)
    })

    it('open lower bound (min=null): admits any value <= max', () => {
      const c = curation({})
      expect(
        matchesChip(
          params({ cfg: 50 }),
          c,
          chip('cfg', { kind: 'numeric', min: null, max: 50, exact: null })
        )
      ).toBe(true)
      expect(
        matchesChip(
          params({ cfg: 51 }),
          c,
          chip('cfg', { kind: 'numeric', min: null, max: 50, exact: null })
        )
      ).toBe(false)
    })
  })

  describe('text substring case-insensitive (FILTER-05)', () => {
    it('admits asset whose positive prompt contains the substring (case-insensitive)', () => {
      const p = params({ positivePrompt: 'a beautiful masterpiece' })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('positivePrompt', { kind: 'text', substring: 'masterpiece' })
        )
      ).toBe(true)
    })

    it('text chip is case-insensitive: MASTER matches master shot', () => {
      const p = params({ positivePrompt: 'master shot' })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('positivePrompt', { kind: 'text', substring: 'MASTER' })
        )
      ).toBe(true)
    })

    it('excludes asset when positive prompt does not contain the substring', () => {
      const p = params({ positivePrompt: 'beautiful landscape' })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('positivePrompt', { kind: 'text', substring: 'masterpiece' })
        )
      ).toBe(false)
    })

    it('negative prompt chip matches against negative prompt, not positive', () => {
      const p = params({
        positivePrompt: 'beautiful scene',
        negativePrompt: 'ugly distorted'
      })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('negativePrompt', { kind: 'text', substring: 'ugly' })
        )
      ).toBe(true)
      expect(
        matchesChip(
          p,
          c,
          chip('negativePrompt', { kind: 'text', substring: 'beautiful' })
        )
      ).toBe(false)
    })
  })

  describe('resolution (FILTER-04)', () => {
    it('admits asset with matching width×height pair', () => {
      const p = params({ width: 1024, height: 1024 })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('resolution', { kind: 'resolution', pairs: [[1024, 1024]] })
        )
      ).toBe(true)
    })

    it('excludes asset with non-matching resolution', () => {
      const p = params({ width: 512, height: 512 })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('resolution', { kind: 'resolution', pairs: [[1024, 1024]] })
        )
      ).toBe(false)
    })

    it('admits asset when any pair in multi-pair chip matches (OR within chip)', () => {
      const p = params({ width: 768, height: 512 })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('resolution', {
            kind: 'resolution',
            pairs: [
              [1024, 1024],
              [768, 512]
            ]
          })
        )
      ).toBe(true)
    })
  })

  describe('boolean favourite (FILTER-07)', () => {
    it('admits asset with favourite=true when chip value is true', () => {
      const p = params({})
      const c = curation({ favourite: true })
      expect(
        matchesChip(p, c, chip('favourite', { kind: 'boolean', value: true }))
      ).toBe(true)
    })

    it('excludes asset with favourite=false when chip value is true', () => {
      const p = params({})
      const c = curation({ favourite: false })
      expect(
        matchesChip(p, c, chip('favourite', { kind: 'boolean', value: true }))
      ).toBe(false)
    })

    it('admits asset with favourite=false when chip value is false (explicit non-favourite filter)', () => {
      const p = params({})
      const c = curation({ favourite: false })
      expect(
        matchesChip(p, c, chip('favourite', { kind: 'boolean', value: false }))
      ).toBe(true)
    })
  })

  describe('tags (FILTER-07)', () => {
    it('admits asset whose curation tags include chip value', () => {
      const p = params({})
      const c = curation({ tags: ['portrait', 'landscape'] })
      expect(
        matchesChip(
          p,
          c,
          chip('tags', { kind: 'categorical', values: ['portrait'] })
        )
      ).toBe(true)
    })

    it('excludes asset whose curation tags do not include chip value', () => {
      const p = params({})
      const c = curation({ tags: ['landscape'] })
      expect(
        matchesChip(
          p,
          c,
          chip('tags', { kind: 'categorical', values: ['portrait'] })
        )
      ).toBe(false)
    })

    it('admits asset with either tag in multi-value chip (OR within chip)', () => {
      const p = params({})
      const c = curation({ tags: ['b'] })
      expect(
        matchesChip(
          p,
          c,
          chip('tags', { kind: 'categorical', values: ['a', 'b'] })
        )
      ).toBe(true)
    })

    it('excludes asset with empty tags when chip requires a tag', () => {
      const p = params({})
      const c = curation({ tags: [] })
      expect(
        matchesChip(
          p,
          c,
          chip('tags', { kind: 'categorical', values: ['portrait'] })
        )
      ).toBe(false)
    })
  })

  describe('silently null — missing params excluded (FILTER-09)', () => {
    it('excludes asset with undefined cfg when numeric chip queries cfg', () => {
      const p = params({ cfg: undefined })
      const c = curation({})
      expect(
        matchesChip(p, c, chip('cfg', { kind: 'numeric', min: 6, max: 8, exact: null }))
      ).toBe(false)
    })

    it('excludes asset with undefined model when categorical chip queries model', () => {
      const p = params({ model: undefined })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('model', { kind: 'categorical', values: ['x.safetensors'] })
        )
      ).toBe(false)
    })

    it('excludes asset with undefined positivePrompt when text chip queries it', () => {
      const p = params({ positivePrompt: undefined })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('positivePrompt', { kind: 'text', substring: 'x' })
        )
      ).toBe(false)
    })

    it('excludes asset when width/height undefined and resolution chip is active', () => {
      const p = params({ width: undefined, height: undefined })
      const c = curation({})
      expect(
        matchesChip(
          p,
          c,
          chip('resolution', { kind: 'resolution', pairs: [[1024, 1024]] })
        )
      ).toBe(false)
    })
  })

  describe('OR within chip / AND across chips (D-12)', () => {
    it('single multi-value categorical chip: matches assets with EITHER value (OR)', () => {
      const c = curation({})
      const ch = chip('sampler', {
        kind: 'categorical',
        values: ['euler', 'dpmpp_2m']
      })
      expect(matchesChip(params({ sampler: 'euler' }), c, ch)).toBe(true)
      expect(matchesChip(params({ sampler: 'dpmpp_2m' }), c, ch)).toBe(true)
      expect(matchesChip(params({ sampler: 'ddim' }), c, ch)).toBe(false)
    })
  })
})

// --- matchesTimeRange ---

describe('matchesTimeRange (FILTER-06)', () => {
  describe('preset: all', () => {
    it('returns true for any timestamp', () => {
      const range: TimeRange = { preset: 'all', from: null, to: null }
      expect(matchesTimeRange(0, range, NOW_MS)).toBe(true)
      expect(matchesTimeRange(NOW_MS, range, NOW_MS)).toBe(true)
      expect(matchesTimeRange(NOW_MS - 365 * 86_400_000, range, NOW_MS)).toBe(
        true
      )
    })
  })

  describe('preset: today', () => {
    it('admits timestamp within the last 24h', () => {
      const range: TimeRange = { preset: 'today', from: null, to: null }
      expect(matchesTimeRange(NOW_MS - 60_000, range, NOW_MS)).toBe(true)
    })

    it('excludes timestamp more than 24h ago', () => {
      const range: TimeRange = { preset: 'today', from: null, to: null }
      expect(
        matchesTimeRange(NOW_MS - 2 * 86_400_000, range, NOW_MS)
      ).toBe(false)
    })
  })

  describe('preset: thisWeek', () => {
    it('admits timestamp within the last 7 days', () => {
      const range: TimeRange = { preset: 'thisWeek', from: null, to: null }
      expect(
        matchesTimeRange(NOW_MS - 3 * 86_400_000, range, NOW_MS)
      ).toBe(true)
    })

    it('excludes timestamp more than 7 days ago', () => {
      const range: TimeRange = { preset: 'thisWeek', from: null, to: null }
      expect(
        matchesTimeRange(NOW_MS - 8 * 86_400_000, range, NOW_MS)
      ).toBe(false)
    })
  })

  describe('preset: thisMonth', () => {
    it('admits timestamp within the last 30 days', () => {
      const range: TimeRange = { preset: 'thisMonth', from: null, to: null }
      expect(
        matchesTimeRange(NOW_MS - 15 * 86_400_000, range, NOW_MS)
      ).toBe(true)
    })

    it('excludes timestamp more than 30 days ago', () => {
      const range: TimeRange = { preset: 'thisMonth', from: null, to: null }
      expect(
        matchesTimeRange(NOW_MS - 32 * 86_400_000, range, NOW_MS)
      ).toBe(false)
    })
  })

  describe('preset: custom', () => {
    it('admits timestamp within custom from/to range (inclusive)', () => {
      const range: TimeRange = {
        preset: 'custom',
        from: 1000,
        to: 2000
      }
      expect(matchesTimeRange(1500, range, NOW_MS)).toBe(true)
    })

    it('admits timestamp at from boundary (inclusive)', () => {
      const range: TimeRange = {
        preset: 'custom',
        from: 1000,
        to: 2000
      }
      expect(matchesTimeRange(1000, range, NOW_MS)).toBe(true)
    })

    it('admits timestamp at to boundary (inclusive)', () => {
      const range: TimeRange = {
        preset: 'custom',
        from: 1000,
        to: 2000
      }
      expect(matchesTimeRange(2000, range, NOW_MS)).toBe(true)
    })

    it('excludes timestamp below custom from', () => {
      const range: TimeRange = {
        preset: 'custom',
        from: 1000,
        to: 2000
      }
      expect(matchesTimeRange(999, range, NOW_MS)).toBe(false)
    })

    it('excludes timestamp above custom to', () => {
      const range: TimeRange = {
        preset: 'custom',
        from: 1000,
        to: 2000
      }
      expect(matchesTimeRange(2001, range, NOW_MS)).toBe(false)
    })
  })
})

// --- getDateRangeForPreset ---

describe('getDateRangeForPreset', () => {
  it('returns null for preset: all', () => {
    expect(getDateRangeForPreset('all', NOW_MS)).toBeNull()
  })

  it('today window spans exactly 24h ending at nowMs', () => {
    const result = getDateRangeForPreset('today', NOW_MS)
    expect(result).not.toBeNull()
    expect(result!.to).toBe(NOW_MS)
    expect(result!.to - result!.from).toBe(86_400_000)
  })

  it('thisWeek window spans exactly 7 days ending at nowMs', () => {
    const result = getDateRangeForPreset('thisWeek', NOW_MS)
    expect(result).not.toBeNull()
    expect(result!.to).toBe(NOW_MS)
    expect(result!.to - result!.from).toBe(7 * 86_400_000)
  })

  it('thisMonth window spans exactly 30 days ending at nowMs', () => {
    const result = getDateRangeForPreset('thisMonth', NOW_MS)
    expect(result).not.toBeNull()
    expect(result!.to).toBe(NOW_MS)
    expect(result!.to - result!.from).toBe(30 * 86_400_000)
  })

  it('custom preset returns null (caller uses range.from/to directly)', () => {
    expect(getDateRangeForPreset('custom', NOW_MS)).toBeNull()
  })
})

// --- applyFilterChips — integration ---

describe('applyFilterChips — integration', () => {
  const defaultTimeRange: TimeRange = { preset: 'all', from: null, to: null }

  function buildMaps(
    assets: { hash: string; p: NormalizedParams; c?: CurationRecord }[]
  ) {
    const hashToParams = new Map<string, NormalizedParams>(
      assets.map(({ hash, p }) => [hash, p])
    )
    const hashToCuration = new Map<string, CurationRecord>(
      assets
        .filter((a) => a.c !== undefined)
        .map(({ hash, c }) => [hash, c!])
    )
    return { hashToParams, hashToCuration }
  }

  it('returns all hashes when no chips, range=all, showHidden=true', () => {
    const { hashToParams, hashToCuration } = buildMaps([
      { hash: 'a', p: params({}) },
      { hash: 'b', p: params({}) },
      { hash: 'c', p: params({ hidden: undefined }) }
    ])
    const result = applyFilterChips(
      hashToParams,
      hashToCuration,
      [],
      true,
      defaultTimeRange,
      NOW_MS
    )
    expect(result).toHaveLength(3)
    expect([...result].sort()).toEqual(['a', 'b', 'c'])
  })

  it('excludes hashes whose curation.hidden is true when showHidden=false (FILTER-11)', () => {
    const { hashToParams, hashToCuration } = buildMaps([
      { hash: 'visible', p: params({}), c: curation({ hidden: false }) },
      { hash: 'hidden', p: params({}), c: curation({ hidden: true }) }
    ])
    const result = applyFilterChips(
      hashToParams,
      hashToCuration,
      [],
      false,
      defaultTimeRange,
      NOW_MS
    )
    expect(result).toContain('visible')
    expect(result).not.toContain('hidden')
  })

  it('admits hidden hashes when showHidden=true (FILTER-11)', () => {
    const { hashToParams, hashToCuration } = buildMaps([
      { hash: 'visible', p: params({}), c: curation({ hidden: false }) },
      { hash: 'hidden', p: params({}), c: curation({ hidden: true }) }
    ])
    const result = applyFilterChips(
      hashToParams,
      hashToCuration,
      [],
      true,
      defaultTimeRange,
      NOW_MS
    )
    expect(result).toContain('visible')
    expect(result).toContain('hidden')
  })

  it('hash absent from hashToCuration treated as default curation (not hidden) — admitted when showHidden=false', () => {
    const hashToParams = new Map<string, NormalizedParams>([
      ['no-curation', params({})]
    ])
    const hashToCuration = new Map<string, CurationRecord>() // empty

    const result = applyFilterChips(
      hashToParams,
      hashToCuration,
      [],
      false,
      defaultTimeRange,
      NOW_MS
    )
    expect(result).toContain('no-curation')
  })

  it('ANDs time range, showHidden, and chip predicates together', () => {
    const oldTimestamp = NOW_MS - 10 * 86_400_000 // 10 days ago
    const { hashToParams, hashToCuration } = buildMaps([
      {
        hash: 'passes-all',
        p: params({ model: 'sd_xl.safetensors', timestamp: NOW_MS - 60_000 }),
        c: curation({ hidden: false })
      },
      {
        hash: 'fails-time',
        p: params({ model: 'sd_xl.safetensors', timestamp: oldTimestamp }),
        c: curation({ hidden: false })
      },
      {
        hash: 'fails-model',
        p: params({ model: 'other.safetensors', timestamp: NOW_MS - 60_000 }),
        c: curation({ hidden: false })
      },
      {
        hash: 'fails-hidden',
        p: params({ model: 'sd_xl.safetensors', timestamp: NOW_MS - 60_000 }),
        c: curation({ hidden: true })
      }
    ])
    const chips: FilterChip[] = [
      chip('model', { kind: 'categorical', values: ['sd_xl.safetensors'] })
    ]
    const timeRange: TimeRange = { preset: 'today', from: null, to: null }

    const result = applyFilterChips(
      hashToParams,
      hashToCuration,
      chips,
      false,
      timeRange,
      NOW_MS
    )
    expect(result).toContain('passes-all')
    expect(result).not.toContain('fails-time')
    expect(result).not.toContain('fails-model')
    expect(result).not.toContain('fails-hidden')
  })

  it('returns subtractive result — excluded hashes absent (FILTER-08)', () => {
    const { hashToParams, hashToCuration } = buildMaps([
      { hash: 'keep', p: params({ cfg: 7 }), c: curation({}) },
      { hash: 'drop', p: params({ cfg: 4 }), c: curation({}) }
    ])
    const chips: FilterChip[] = [
      chip('cfg', { kind: 'numeric', min: 6, max: 8, exact: null })
    ]
    const result = applyFilterChips(
      hashToParams,
      hashToCuration,
      chips,
      true,
      defaultTimeRange,
      NOW_MS
    )
    expect(result).toContain('keep')
    expect(result).not.toContain('drop')
  })

  it('two chips AND together: both model AND sampler must match', () => {
    const { hashToParams, hashToCuration } = buildMaps([
      {
        hash: 'both-match',
        p: params({ model: 'sd_xl', sampler: 'euler' }),
        c: curation({})
      },
      {
        hash: 'only-model',
        p: params({ model: 'sd_xl', sampler: 'ddim' }),
        c: curation({})
      },
      {
        hash: 'only-sampler',
        p: params({ model: 'other', sampler: 'euler' }),
        c: curation({})
      }
    ])
    const chips: FilterChip[] = [
      chip('sampler', { kind: 'categorical', values: ['euler'] }),
      chip('model', { kind: 'categorical', values: ['sd_xl'] })
    ]
    const result = applyFilterChips(
      hashToParams,
      hashToCuration,
      chips,
      true,
      defaultTimeRange,
      NOW_MS
    )
    expect(result).toContain('both-match')
    expect(result).not.toContain('only-model')
    expect(result).not.toContain('only-sampler')
  })

  it('empty chip list returns all hashes filtered only by time/hidden', () => {
    const { hashToParams, hashToCuration } = buildMaps([
      { hash: 'a', p: params({ model: 'x' }), c: curation({}) },
      { hash: 'b', p: params({ model: 'y' }), c: curation({}) }
    ])
    const result = applyFilterChips(
      hashToParams,
      hashToCuration,
      [],
      true,
      defaultTimeRange,
      NOW_MS
    )
    expect(result).toContain('a')
    expect(result).toContain('b')
  })

  it('result is unordered membership (FILTER-08): check membership not order', () => {
    const hashes = ['h1', 'h2', 'h3']
    const hashToParams = new Map<string, NormalizedParams>(
      hashes.map((h) => [h, params({ cfg: 7 })])
    )
    const hashToCuration = new Map<string, CurationRecord>()
    const chips: FilterChip[] = [
      chip('cfg', { kind: 'numeric', min: 6, max: 8, exact: null })
    ]
    const result = applyFilterChips(
      hashToParams,
      hashToCuration,
      chips,
      true,
      defaultTimeRange,
      NOW_MS
    )
    // membership check — order irrelevant
    expect(new Set(result)).toEqual(new Set(hashes))
  })
})
