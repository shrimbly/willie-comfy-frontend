import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { GROUPING_AXES } from './groupAxes'
import type { GroupingAxis, WithinClusterSortMode } from './groupAxes'
import {
  computeClusterLayout,
  computeNestingOrder
} from './clusterLayout'
import type { NormalizedParams } from './paramNormalize'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

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
    workflowFilename: null
  }
  return { ...base, ...overrides }
}

function paramsMap(
  entries: Record<string, Partial<NormalizedParams>>
): Map<string, NormalizedParams> {
  return new Map(
    Object.entries(entries).map(([k, v]) => [k, makeParams(v)])
  )
}

function filenameMap(
  entries: Record<string, string | null>
): Map<string, string | null> {
  return new Map(Object.entries(entries))
}

const DEFAULT_SORT: WithinClusterSortMode = 'newestFirst'
const GRID = 100

// ---------------------------------------------------------------------------
// computeNestingOrder (D-02)
// ---------------------------------------------------------------------------

describe('computeNestingOrder (D-02)', () => {
  it('returns [] when activeAxes is empty', () => {
    const result = computeNestingOrder(
      ['a', 'b'],
      paramsMap({ a: {}, b: {} }),
      filenameMap({ a: null, b: null }),
      []
    )
    expect(result).toEqual([])
  })

  it('returns the single axis when one active axis is provided', () => {
    const result = computeNestingOrder(
      ['a', 'b'],
      paramsMap({
        a: { workflowFilename: 'w1' },
        b: { workflowFilename: 'w2' }
      }),
      filenameMap({ a: null, b: null }),
      ['workflow']
    )
    expect(result).toEqual(['workflow'])
  })

  it('sorts axes by avg bucket size descending', () => {
    // 100 assets total.
    // workflow: 2 distinct values -> avg 50 (biggest bucket, outermost)
    // model: 5 distinct values -> avg 20
    // prompt: 10 distinct values -> avg 10 (smallest bucket, innermost)
    const hashes: string[] = []
    const params: Record<string, Partial<NormalizedParams>> = {}
    for (let i = 0; i < 100; i++) {
      const h = `h${i}`
      hashes.push(h)
      params[h] = {
        workflowFilename: `w${i % 2}`,
        model: `m${i % 5}`,
        positivePrompt: `p${i % 10}`
      }
    }
    const result = computeNestingOrder(
      hashes,
      paramsMap(params),
      filenameMap(Object.fromEntries(hashes.map((h) => [h, null]))),
      ['prompt', 'workflow', 'model']
    )
    expect(result).toEqual(['workflow', 'model', 'prompt'])
  })

  it('breaks ties by GROUPING_AXES declaration order', () => {
    // 2 assets each with their own unique value for workflow and model
    // workflow: 2 distinct -> avg 1
    // model:    2 distinct -> avg 1
    // declaration order: workflow=0 < model=3
    const result = computeNestingOrder(
      ['a', 'b'],
      paramsMap({
        a: { workflowFilename: 'w1', model: 'm1' },
        b: { workflowFilename: 'w2', model: 'm2' }
      }),
      filenameMap({ a: null, b: null }),
      ['model', 'workflow']
    )
    expect(result).toEqual(['workflow', 'model'])
  })
})

// ---------------------------------------------------------------------------
// computeClusterLayout — empty + zero-grouping cases
// ---------------------------------------------------------------------------

describe('computeClusterLayout — degenerate cases', () => {
  it('empty visibleHashes returns empty slots and empty leaf root', () => {
    const { root, slots } = computeClusterLayout(
      [],
      new Map(),
      new Map(),
      [],
      DEFAULT_SORT,
      GRID
    )
    expect(slots).toHaveLength(0)
    expect(root.children).toEqual([])
    expect(root.leafHashes).toEqual([])
  })

  it('no activeGroupings -> single leaf, row-wrapping flat grid', () => {
    const hashes = ['h1', 'h2', 'h3', 'h4']
    const params = paramsMap({
      h1: { timestamp: 4 },
      h2: { timestamp: 3 },
      h3: { timestamp: 2 },
      h4: { timestamp: 1 }
    })
    const { root, slots } = computeClusterLayout(
      hashes,
      params,
      filenameMap({ h1: null, h2: null, h3: null, h4: null }),
      [],
      'newestFirst',
      GRID
    )
    expect(root.axis).toBeNull()
    expect(root.children).toEqual([])
    // sqrt(4) = 2 columns
    expect(slots).toHaveLength(4)
    // Row-wrapping: (0,0), (100,0), (0,100), (100,100) when sorted newestFirst
    // Sorted newestFirst -> h1(4), h2(3), h3(2), h4(1)
    expect(slots[0]).toEqual({ hash: 'h1', worldX: 0, worldY: 0 })
    expect(slots[1]).toEqual({ hash: 'h2', worldX: GRID, worldY: 0 })
    expect(slots[2]).toEqual({ hash: 'h3', worldX: 0, worldY: GRID })
    expect(slots[3]).toEqual({ hash: 'h4', worldX: GRID, worldY: GRID })
    expect(root.leafHashes).toEqual(['h1', 'h2', 'h3', 'h4'])
  })
})

// ---------------------------------------------------------------------------
// computeClusterLayout — one active grouping
// ---------------------------------------------------------------------------

describe('computeClusterLayout — single grouping axis', () => {
  it('partitions visibleHashes by bucketKey and emits one leaf per bucket', () => {
    const hashes = ['h1', 'h2', 'h3', 'h4']
    const params = paramsMap({
      h1: { workflowFilename: 'alpha', timestamp: 1 },
      h2: { workflowFilename: 'alpha', timestamp: 2 },
      h3: { workflowFilename: 'beta', timestamp: 3 },
      h4: { workflowFilename: 'beta', timestamp: 4 }
    })
    const { root, slots } = computeClusterLayout(
      hashes,
      params,
      filenameMap({ h1: null, h2: null, h3: null, h4: null }),
      ['workflow'],
      'newestFirst',
      GRID
    )
    expect(root.children).toHaveLength(2)
    // Every input hash appears exactly once across leaf clusters
    const allLeafHashes = root.children.flatMap((c) => c.leafHashes)
    expect(new Set(allLeafHashes)).toEqual(new Set(hashes))
    expect(slots).toHaveLength(4)
  })

  it('routes missing-param assets into an (other) bucket', () => {
    const hashes = ['h1', 'h2', 'h3']
    const params = paramsMap({
      h1: { workflowFilename: 'alpha' },
      h2: { workflowFilename: 'alpha' },
      h3: { workflowFilename: null } // missing -> (other)
    })
    const { root } = computeClusterLayout(
      hashes,
      params,
      filenameMap({ h1: null, h2: null, h3: null }),
      ['workflow'],
      'newestFirst',
      GRID
    )
    const bucketValues = root.children.map((c) => c.bucketValue).sort()
    expect(bucketValues).toEqual(['(other)', 'alpha'])
  })

  it('sorts buckets by size descending with bucketValue tiebreak', () => {
    const hashes = ['a', 'b', 'c', 'd', 'e']
    const params = paramsMap({
      a: { workflowFilename: 'big' }, // size 3
      b: { workflowFilename: 'big' },
      c: { workflowFilename: 'big' },
      d: { workflowFilename: 'small' }, // size 1
      e: { workflowFilename: 'medium' } // size 1
    })
    const { root } = computeClusterLayout(
      hashes,
      params,
      filenameMap({ a: null, b: null, c: null, d: null, e: null }),
      ['workflow'],
      'newestFirst',
      GRID
    )
    // 'big' (3) first; then 'medium' (1) and 'small' (1) tied — alphabetic
    expect(root.children.map((c) => c.bucketValue)).toEqual([
      'big',
      'medium',
      'small'
    ])
  })
})

// ---------------------------------------------------------------------------
// computeClusterLayout — two active groupings (nesting)
// ---------------------------------------------------------------------------

describe('computeClusterLayout — nested groupings', () => {
  it('recursively partitions: outer axis first, inner axis second', () => {
    const hashes = ['a', 'b', 'c', 'd']
    const params = paramsMap({
      a: { workflowFilename: 'w1', model: 'm1' },
      b: { workflowFilename: 'w1', model: 'm2' },
      c: { workflowFilename: 'w2', model: 'm1' },
      d: { workflowFilename: 'w2', model: 'm2' }
    })
    const { root, slots } = computeClusterLayout(
      hashes,
      params,
      filenameMap({ a: null, b: null, c: null, d: null }),
      ['workflow', 'model'],
      DEFAULT_SORT,
      GRID
    )
    // Root has 2 workflow children; each has 2 model children
    expect(root.children).toHaveLength(2)
    for (const wf of root.children) {
      expect(wf.axis).toBe('model')
      expect(wf.children).toHaveLength(2)
      for (const m of wf.children) {
        expect(m.axis).toBeNull() // leaf
        expect(m.children).toHaveLength(0)
        expect(m.leafHashes).toHaveLength(1)
      }
    }
    expect(slots).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// Property tests (Pitfall 2 — unique hash -> single leaf)
// ---------------------------------------------------------------------------

describe('computeClusterLayout — hash uniqueness invariant (property)', () => {
  it('every input hash appears in exactly one leaf cluster (any axis combo)', () => {
    const axisArb = fc.uniqueArray(fc.constantFrom<GroupingAxis>(...GROUPING_AXES), {
      minLength: 0,
      maxLength: 5
    })

    const paramsArb = fc.record({
      workflowFilename: fc.option(
        fc.constantFrom('w1', 'w2', 'w3'),
        { nil: null }
      ),
      model: fc.option(fc.constantFrom('m1', 'm2'), { nil: undefined as unknown as string }),
      positivePrompt: fc.option(
        fc.constantFrom('cat sitting', 'DOG running', 'cat sitting'),
        { nil: undefined as unknown as string }
      ),
      width: fc.option(fc.constantFrom(512, 1024, 1920), {
        nil: undefined as unknown as number
      }),
      height: fc.option(fc.constantFrom(512, 1024, 1080), {
        nil: undefined as unknown as number
      }),
      timestamp: fc.integer({ min: 0, max: 1000 })
    })

    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), {
          minLength: 1,
          maxLength: 15
        }),
        fc.array(paramsArb, { minLength: 15, maxLength: 15 }),
        axisArb,
        (hashes, allParams, axes) => {
          const params = new Map<string, NormalizedParams>()
          const filenames = new Map<string, string | null>()
          hashes.forEach((h, i) => {
            const p = allParams[i % allParams.length]
            params.set(
              h,
              makeParams({
                workflowFilename: p.workflowFilename,
                model: p.model ?? undefined,
                positivePrompt: p.positivePrompt ?? undefined,
                width: p.width ?? undefined,
                height: p.height ?? undefined,
                timestamp: p.timestamp
              })
            )
            filenames.set(h, null)
          })

          const { slots } = computeClusterLayout(
            hashes,
            params,
            filenames,
            axes,
            DEFAULT_SORT,
            GRID
          )
          // Every input hash appears exactly once in the flattened slots
          expect(slots).toHaveLength(hashes.length)
          const slotHashes = slots.map((s) => s.hash)
          expect(new Set(slotHashes).size).toBe(hashes.length)
          expect(new Set(slotHashes)).toEqual(new Set(hashes))
          // All coordinates are finite numbers
          for (const s of slots) {
            expect(Number.isFinite(s.worldX)).toBe(true)
            expect(Number.isFinite(s.worldY)).toBe(true)
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})

// ---------------------------------------------------------------------------
// Depth-proportional gap (D-03)
// ---------------------------------------------------------------------------

describe('computeClusterLayout — depth-proportional gap (D-03)', () => {
  it('siblings at depth 0 are spaced strictly further than siblings at depth 1', () => {
    // Build a 2x2x2 structure: workflow outer, model middle, prompt inner.
    // Each leaf gets 1 asset so child bounds are identical and only the gap
    // differs across depths.
    const hashes: string[] = []
    const entries: Record<string, Partial<NormalizedParams>> = {}
    let ts = 0
    for (const w of ['w1', 'w2']) {
      for (const m of ['m1', 'm2']) {
        for (const p of ['p1', 'p2']) {
          const h = `${w}-${m}-${p}`
          hashes.push(h)
          entries[h] = {
            workflowFilename: w,
            model: m,
            positivePrompt: p,
            timestamp: ts++
          }
        }
      }
    }
    const params = paramsMap(entries)
    const filenames = filenameMap(
      Object.fromEntries(hashes.map((h) => [h, null]))
    )

    const { root } = computeClusterLayout(
      hashes,
      params,
      filenames,
      ['workflow', 'model', 'prompt'],
      DEFAULT_SORT,
      GRID
    )

    // Depth 0: root.children are workflow clusters. Gap = GRID * (3 - 0 + 1) = 4*GRID
    // Depth 1: each workflow.children are model clusters. Gap = GRID * (3 - 1 + 1) = 3*GRID
    // Distance between sibling top-lefts at depth 0 > distance at depth 1
    expect(root.children).toHaveLength(2)
    const wf0 = root.children[0]
    const wf1 = root.children[1]
    const depth0Distance =
      Math.abs(wf1.boundsWorld.x - wf0.boundsWorld.x) +
      Math.abs(wf1.boundsWorld.y - wf0.boundsWorld.y)

    expect(wf0.children).toHaveLength(2)
    const m0 = wf0.children[0]
    const m1 = wf0.children[1]
    const depth1Distance =
      Math.abs(m1.boundsWorld.x - m0.boundsWorld.x) +
      Math.abs(m1.boundsWorld.y - m0.boundsWorld.y)

    expect(depth0Distance).toBeGreaterThan(depth1Distance)
  })
})

// ---------------------------------------------------------------------------
// Perf budget (GROUP-10 / D-05)
// ---------------------------------------------------------------------------

describe('computeClusterLayout — perf budget (GROUP-10 / D-05)', () => {
  it('completes a 5000-hash x 3-axis layout in under 100ms', () => {
    const hashes: string[] = []
    const entries: Record<string, Partial<NormalizedParams>> = {}
    for (let i = 0; i < 5000; i++) {
      const h = `hash-${i}`
      hashes.push(h)
      entries[h] = {
        workflowFilename: `w${i % 5}`,
        model: `m${i % 5}`,
        positivePrompt: `p${i % 5}`,
        width: 1024,
        height: 1024,
        timestamp: i
      }
    }
    const params = paramsMap(entries)
    const filenames = filenameMap(
      Object.fromEntries(hashes.map((h) => [h, null]))
    )

    const nestingOrder = computeNestingOrder(
      hashes,
      params,
      filenames,
      ['workflow', 'model', 'prompt']
    )

    const t0 = performance.now()
    const { slots } = computeClusterLayout(
      hashes,
      params,
      filenames,
      nestingOrder,
      DEFAULT_SORT,
      GRID
    )
    const duration = performance.now() - t0

    expect(slots).toHaveLength(5000)
    expect(duration).toBeLessThan(100)
  })
})
