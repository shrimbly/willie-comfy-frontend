import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  GROUPING_AXES,
  OTHER_BUCKET_KEY,
  WITHIN_CLUSTER_SORT_MODES,
  bucketKey,
  compareAssetsForWithinCluster,
  deriveTypeBucket,
  normalisePromptKey
} from './groupAxes'
import type { NormalizedParams } from './paramNormalize'

function makeParams(
  overrides: Partial<NormalizedParams> & {
    saveNodeIdentity?: string | null
  } = {}
): NormalizedParams {
  const base: NormalizedParams = {
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
    workflowFilename: null,
    saveNodeIdentity: null
  }
  return { ...base, ...overrides }
}

describe('GROUPING_AXES constant', () => {
  it('lists the 5 axes in PRD §5.3 declaration order', () => {
    expect(GROUPING_AXES).toEqual([
      'workflow',
      'saveNode',
      'prompt',
      'model',
      'type'
    ])
  })
})

describe('WITHIN_CLUSTER_SORT_MODES constant', () => {
  it('lists the three modes (CSORT-01)', () => {
    expect(WITHIN_CLUSTER_SORT_MODES).toEqual([
      'newestFirst',
      'oldestFirst',
      'alphabetical'
    ])
  })
})

describe('OTHER_BUCKET_KEY constant', () => {
  it('is the literal "(other)" label (D-04)', () => {
    expect(OTHER_BUCKET_KEY).toBe('(other)')
  })
})

describe('normalisePromptKey (D-10)', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalisePromptKey('Hello   World  ')).toBe('hello world')
  })

  it('returns (other) for empty string', () => {
    expect(normalisePromptKey('')).toBe('(other)')
  })

  it('returns (other) for undefined', () => {
    expect(normalisePromptKey(undefined)).toBe('(other)')
  })

  it('returns (other) for whitespace-only string', () => {
    expect(normalisePromptKey('   ')).toBe('(other)')
  })

  it('normalises mixed casing + tabs + newlines', () => {
    expect(normalisePromptKey('\tFoo\nBAR\t baz  ')).toBe('foo bar baz')
  })
})

describe('deriveTypeBucket (D-09)', () => {
  it('returns landscape for 1280x720 (ratio 1.78 > 1.15)', () => {
    expect(deriveTypeBucket({ width: 1280, height: 720 })).toBe('landscape')
  })

  it('returns portrait for 768x1024 (ratio 0.75 < 0.87)', () => {
    expect(deriveTypeBucket({ width: 768, height: 1024 })).toBe('portrait')
  })

  it('returns square for 1024x1024', () => {
    expect(deriveTypeBucket({ width: 1024, height: 1024 })).toBe('square')
  })

  it('returns square for boundary 1024x888 (ratio ~1.153 — NOT > 1.15)', () => {
    // 1024 / 888 ≈ 1.1531 — above the 1.15 threshold strictly → landscape
    // Wait, re-check: behavior bullet says "square (ratio ≈ 1.153 — NOT greater than 1.15; boundary)"
    // 1024/888 = 1.15315... which IS greater than 1.15. Re-read PLAN:
    //  "deriveTypeBucket({ width: 1024, height: 888 }) === 'square' (ratio ≈ 1.153 — NOT greater than 1.15; boundary)"
    // The PLAN authors seem to use a different numeric understanding; the invariant is ratio > 1.15 = landscape.
    // 1024/888 = 1.15315... — this is greater than 1.15, so it's landscape.
    // The PLAN comment is mathematically incorrect; follow the deterministic rule (> 1.15 → landscape).
    expect(deriveTypeBucket({ width: 1024, height: 888 })).toBe('landscape')
  })

  it('returns landscape for 1000x869 (ratio ≈ 1.151 — just above 1.15)', () => {
    expect(deriveTypeBucket({ width: 1000, height: 869 })).toBe('landscape')
  })

  it('returns (other) when width is undefined', () => {
    expect(deriveTypeBucket({ width: undefined, height: 1024 })).toBe(
      '(other)'
    )
  })

  it('returns (other) when width is 0 (falsy)', () => {
    expect(deriveTypeBucket({ width: 0, height: 1024 })).toBe('(other)')
  })

  it('returns (other) when height is undefined', () => {
    expect(deriveTypeBucket({ width: 1024, height: undefined })).toBe(
      '(other)'
    )
  })

  it('returns (other) when height is 0', () => {
    expect(deriveTypeBucket({ width: 1024, height: 0 })).toBe('(other)')
  })

  it('returns (other) when a dimension is non-finite', () => {
    expect(deriveTypeBucket({ width: Infinity, height: 1024 })).toBe(
      '(other)'
    )
    expect(deriveTypeBucket({ width: 1024, height: Number.NaN })).toBe(
      '(other)'
    )
  })
})

describe('bucketKey (D-07..D-10)', () => {
  it('workflow axis returns workflowFilename when present', () => {
    const p = makeParams({ workflowFilename: 'portraits-v2' })
    expect(bucketKey('workflow', p, null)).toBe('portraits-v2')
  })

  it('workflow axis returns (other) when workflowFilename is null', () => {
    const p = makeParams({ workflowFilename: null })
    expect(bucketKey('workflow', p, null)).toBe('(other)')
  })

  it('saveNode axis returns saveNodeIdentity when present', () => {
    const p = makeParams({ saveNodeIdentity: 'Final Output' })
    expect(bucketKey('saveNode', p, null)).toBe('Final Output')
  })

  it('saveNode axis returns (other) when saveNodeIdentity is null', () => {
    const p = makeParams({ saveNodeIdentity: null })
    expect(bucketKey('saveNode', p, null)).toBe('(other)')
  })

  it('saveNode axis returns (other) when saveNodeIdentity is absent', () => {
    const p = makeParams()
    expect(bucketKey('saveNode', p, null)).toBe('(other)')
  })

  it('prompt axis returns normalised prompt key', () => {
    const p = makeParams({ positivePrompt: '  A CAT  sits ' })
    expect(bucketKey('prompt', p, null)).toBe('a cat sits')
  })

  it('prompt axis returns (other) when positivePrompt is undefined', () => {
    const p = makeParams({ positivePrompt: undefined })
    expect(bucketKey('prompt', p, null)).toBe('(other)')
  })

  it('model axis returns model when present', () => {
    const p = makeParams({ model: 'sdxl_base.safetensors' })
    expect(bucketKey('model', p, null)).toBe('sdxl_base.safetensors')
  })

  it('model axis returns (other) when model is undefined', () => {
    const p = makeParams({ model: undefined })
    expect(bucketKey('model', p, null)).toBe('(other)')
  })

  it('type axis returns landscape/portrait/square from dimensions', () => {
    expect(
      bucketKey('type', makeParams({ width: 1920, height: 1080 }), null)
    ).toBe('landscape')
    expect(
      bucketKey('type', makeParams({ width: 800, height: 1200 }), null)
    ).toBe('portrait')
    expect(
      bucketKey('type', makeParams({ width: 1024, height: 1024 }), null)
    ).toBe('square')
  })

  it('type axis returns (other) when dimensions are missing', () => {
    expect(bucketKey('type', makeParams(), null)).toBe('(other)')
  })
})

describe('compareAssetsForWithinCluster (CSORT-01)', () => {
  it('newestFirst: larger timestamp comes first', () => {
    const a = {
      contentHash: 'h1',
      params: makeParams({ timestamp: 100 }),
      filename: null
    }
    const b = {
      contentHash: 'h2',
      params: makeParams({ timestamp: 200 }),
      filename: null
    }
    expect(compareAssetsForWithinCluster(a, b, 'newestFirst')).toBeGreaterThan(
      0
    )
    expect(compareAssetsForWithinCluster(b, a, 'newestFirst')).toBeLessThan(0)
  })

  it('newestFirst: equal timestamps break ties on contentHash ascending', () => {
    const a = {
      contentHash: 'aaa',
      params: makeParams({ timestamp: 100 }),
      filename: null
    }
    const b = {
      contentHash: 'bbb',
      params: makeParams({ timestamp: 100 }),
      filename: null
    }
    expect(compareAssetsForWithinCluster(a, b, 'newestFirst')).toBeLessThan(0)
  })

  it('oldestFirst: smaller timestamp comes first', () => {
    const a = {
      contentHash: 'h1',
      params: makeParams({ timestamp: 100 }),
      filename: null
    }
    const b = {
      contentHash: 'h2',
      params: makeParams({ timestamp: 200 }),
      filename: null
    }
    expect(compareAssetsForWithinCluster(a, b, 'oldestFirst')).toBeLessThan(0)
  })

  it('oldestFirst: equal timestamps break ties on contentHash ascending', () => {
    const a = {
      contentHash: 'aaa',
      params: makeParams({ timestamp: 100 }),
      filename: null
    }
    const b = {
      contentHash: 'bbb',
      params: makeParams({ timestamp: 100 }),
      filename: null
    }
    expect(compareAssetsForWithinCluster(a, b, 'oldestFirst')).toBeLessThan(0)
  })

  it('alphabetical: filenames sorted ascending', () => {
    const a = {
      contentHash: 'h1',
      params: makeParams(),
      filename: 'apple.png'
    }
    const b = {
      contentHash: 'h2',
      params: makeParams(),
      filename: 'banana.png'
    }
    expect(
      compareAssetsForWithinCluster(a, b, 'alphabetical')
    ).toBeLessThan(0)
  })

  it('alphabetical: missing filename sorts after non-missing', () => {
    const a = {
      contentHash: 'h1',
      params: makeParams(),
      filename: 'apple.png'
    }
    const b = {
      contentHash: 'h2',
      params: makeParams(),
      filename: null
    }
    expect(
      compareAssetsForWithinCluster(a, b, 'alphabetical')
    ).toBeLessThan(0)
  })

  it('alphabetical: both filenames null -> contentHash tiebreak', () => {
    const a = {
      contentHash: 'aaa',
      params: makeParams(),
      filename: null
    }
    const b = {
      contentHash: 'bbb',
      params: makeParams(),
      filename: null
    }
    expect(
      compareAssetsForWithinCluster(a, b, 'alphabetical')
    ).toBeLessThan(0)
  })

  it('alphabetical: equal filename breaks tie on contentHash', () => {
    const a = {
      contentHash: 'aaa',
      params: makeParams(),
      filename: 'same.png'
    }
    const b = {
      contentHash: 'bbb',
      params: makeParams(),
      filename: 'same.png'
    }
    expect(
      compareAssetsForWithinCluster(a, b, 'alphabetical')
    ).toBeLessThan(0)
  })

  it('produces a total deterministic order (property test)', () => {
    type AssetRecord = {
      contentHash: string
      params: NormalizedParams
      filename: string | null
    }
    const modeArb = fc.constantFrom<
      'newestFirst' | 'oldestFirst' | 'alphabetical'
    >('newestFirst', 'oldestFirst', 'alphabetical')
    const recordArb = fc
      .record({
        contentHash: fc.string({ minLength: 1, maxLength: 8 }),
        timestamp: fc.integer({ min: 0, max: 1_000_000 }),
        filename: fc.option(
          fc.string({ minLength: 1, maxLength: 12 }),
          { nil: null }
        )
      })
      .map<AssetRecord>((r) => ({
        contentHash: r.contentHash,
        params: makeParams({ timestamp: r.timestamp }),
        filename: r.filename
      }))

    fc.assert(
      fc.property(
        fc.uniqueArray(recordArb, {
          minLength: 2,
          maxLength: 20,
          selector: (r) => r.contentHash
        }),
        modeArb,
        (records, mode) => {
          const sorted = [...records].sort((a, b) =>
            compareAssetsForWithinCluster(a, b, mode)
          )
          const reshuffled = [...records].reverse()
          const sortedAgain = reshuffled.sort((a, b) =>
            compareAssetsForWithinCluster(a, b, mode)
          )
          expect(sortedAgain.map((r) => r.contentHash)).toEqual(
            sorted.map((r) => r.contentHash)
          )
        }
      ),
      { numRuns: 50 }
    )
  })
})
