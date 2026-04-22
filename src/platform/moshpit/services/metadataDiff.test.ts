/**
 * Metadata diff behavioural spec for Plan 05-02 (PEEK-02 + PEEK-03).
 *
 * Covers:
 *   - diffParams classification over PARAM_DIFF_KEY_ORDER
 *   - diffLoras concrete cases + (state, name) sort ordering
 *   - diffLoras permutation-invariance (fast-check property — PEEK-03 literal)
 *   - Pure-module invariant (no vue / pinia / '@/' runtime imports)
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { PARAM_DIFF_KEY_ORDER, diffLoras, diffParams } from './metadataDiff';
import type { LoraDiffEntry } from './metadataDiff';
import type { NormalizedParams } from './paramNormalize'

function makeParams(
  overrides: Partial<NormalizedParams> = {}
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

// Uniqify LoRA arrays by name (last-weight-wins) so permutation property tests
// don't hit the duplicate-name case — documented semantics, see diffLoras impl.
function uniqueByName(
  loras: readonly { name: string; weight: number }[]
): { name: string; weight: number }[] {
  const map = new Map<string, number>()
  for (const l of loras) map.set(l.name, l.weight)
  return [...map.entries()].map(([name, weight]) => ({ name, weight }))
}

describe('PARAM_DIFF_KEY_ORDER', () => {
  it('covers every NormalizedParams key except loras exactly once', () => {
    const all = Object.keys(makeParams()) as (keyof NormalizedParams)[]
    const expected = all.filter((k) => k !== 'loras').sort()
    const actual = [...PARAM_DIFF_KEY_ORDER].sort()
    expect(actual).toEqual(expected)
    // No duplicates
    expect(new Set(PARAM_DIFF_KEY_ORDER).size).toBe(PARAM_DIFF_KEY_ORDER.length)
  })

  it('does not include loras (handled separately via diffLoras)', () => {
    expect(PARAM_DIFF_KEY_ORDER).not.toContain('loras')
  })
})

describe('diffParams', () => {
  it('identical params — all rows state === match', () => {
    const p = makeParams({
      model: 'sdxl.safetensors',
      cfg: 7,
      steps: 20,
      sampler: 'euler',
      scheduler: 'normal',
      seed: 42,
      width: 1024,
      height: 1024,
      positivePrompt: 'a cat',
      negativePrompt: 'blurry',
      timestamp: 1000,
      workflowFingerprint: 'fp',
      workflowFilename: 'wf',
      saveNodeIdentity: 'SaveImage'
    })
    const rows = diffParams(p, p)
    for (const row of rows) {
      expect(row.state).toBe('match')
    }
    expect(rows.length).toBe(PARAM_DIFF_KEY_ORDER.length)
  })

  it('returns rows in PARAM_DIFF_KEY_ORDER', () => {
    const a = makeParams()
    const b = makeParams()
    const rows = diffParams(a, b)
    expect(rows.map((r) => r.key)).toEqual([...PARAM_DIFF_KEY_ORDER])
  })

  it('row count equals PARAM_DIFF_KEY_ORDER.length (loras excluded)', () => {
    const rows = diffParams(makeParams(), makeParams())
    expect(rows.length).toBe(PARAM_DIFF_KEY_ORDER.length)
  })

  it('cfg differ — a=7 vs b=9 — state=differ with values preserved', () => {
    const a = makeParams({ cfg: 7 })
    const b = makeParams({ cfg: 9 })
    const row = diffParams(a, b).find((r) => r.key === 'cfg')
    expect(row).toBeDefined()
    expect(row!.state).toBe('differ')
    expect(row!.valueA).toBe(7)
    expect(row!.valueB).toBe(9)
  })

  it('model onlyA — a set, b undefined — state=onlyA', () => {
    const a = makeParams({ model: 'foo.safetensors' })
    const b = makeParams({ model: undefined })
    const row = diffParams(a, b).find((r) => r.key === 'model')
    expect(row!.state).toBe('onlyA')
    expect(row!.valueA).toBe('foo.safetensors')
    expect(row!.valueB).toBeUndefined()
  })

  it('negativePrompt onlyB — a undefined, b set — state=onlyB', () => {
    const a = makeParams({ negativePrompt: undefined })
    const b = makeParams({ negativePrompt: 'bad' })
    const row = diffParams(a, b).find((r) => r.key === 'negativePrompt')
    expect(row!.state).toBe('onlyB')
    expect(row!.valueA).toBeUndefined()
    expect(row!.valueB).toBe('bad')
  })

  it('seed missingBoth — both undefined — state=missingBoth', () => {
    const a = makeParams({ seed: undefined })
    const b = makeParams({ seed: undefined })
    const row = diffParams(a, b).find((r) => r.key === 'seed')
    expect(row!.state).toBe('missingBoth')
  })

  it('workflowFilename null on both sides — state=missingBoth', () => {
    const rows = diffParams(
      makeParams({ workflowFilename: null }),
      makeParams({ workflowFilename: null })
    )
    const row = rows.find((r) => r.key === 'workflowFilename')
    expect(row!.state).toBe('missingBoth')
  })
})

describe('diffLoras', () => {
  it('empty vs empty — empty output', () => {
    expect(diffLoras([], [])).toEqual([])
  })

  it('[x] vs [] — removed', () => {
    const out = diffLoras([{ name: 'x', weight: 1 }], [])
    expect(out).toEqual([
      { name: 'x', state: 'removed', weightA: 1, weightB: null }
    ])
  })

  it('[] vs [x] — added', () => {
    const out = diffLoras([], [{ name: 'x', weight: 1 }])
    expect(out).toEqual([
      { name: 'x', state: 'added', weightA: null, weightB: 1 }
    ])
  })

  it('same name, same weight — match', () => {
    const out = diffLoras(
      [{ name: 'x', weight: 1 }],
      [{ name: 'x', weight: 1 }]
    )
    expect(out).toEqual([{ name: 'x', state: 'match', weightA: 1, weightB: 1 }])
  })

  it('same name, different weight — weightChanged', () => {
    const out = diffLoras(
      [{ name: 'x', weight: 1 }],
      [{ name: 'x', weight: 0.5 }]
    )
    expect(out).toEqual([
      { name: 'x', state: 'weightChanged', weightA: 1, weightB: 0.5 }
    ])
  })

  it('mixed — entries sorted by (state, name) alphabetical within state', () => {
    const a = [
      { name: 'x', weight: 1 },
      { name: 'y', weight: 2 }
    ]
    const b = [
      { name: 'y', weight: 2 },
      { name: 'z', weight: 3 }
    ]
    const out = diffLoras(a, b)
    // es-toolkit sortBy(['state', 'name']) — states sort lexicographically:
    // added < match < removed < weightChanged
    const expected: readonly LoraDiffEntry[] = [
      { name: 'z', state: 'added', weightA: null, weightB: 3 },
      { name: 'y', state: 'match', weightA: 2, weightB: 2 },
      { name: 'x', state: 'removed', weightA: 1, weightB: null }
    ]
    expect(out).toEqual(expected)
  })

  it('duplicate name within a single input — last-weight-wins semantics', () => {
    // Both entries collapse to one (last write wins during Map build).
    // If upstream paramNormalize ever returns duplicates, diffLoras must not
    // crash and the output must be deterministic — belt-and-braces test.
    const out = diffLoras(
      [
        { name: 'x', weight: 1 },
        { name: 'x', weight: 2 }
      ],
      []
    )
    expect(out).toEqual([
      { name: 'x', state: 'removed', weightA: 2, weightB: null }
    ])
  })

  it('output is sorted (state, name) — alphabetical within state groups', () => {
    const a = [
      { name: 'b', weight: 1 },
      { name: 'a', weight: 1 }
    ]
    const b = [
      { name: 'a', weight: 1 },
      { name: 'b', weight: 1 }
    ]
    const out = diffLoras(a, b)
    // Both match — sorted by name ascending within the 'match' bucket.
    expect(out.map((r) => r.name)).toEqual(['a', 'b'])
  })

  it('is permutation-invariant under shuffling of EITHER input (PEEK-03)', () => {
    const loraArb = fc.array(
      fc.record({
        // 4-char alphabet forces name collisions between A and B
        name: fc.string({ minLength: 1, maxLength: 4 }),
        weight: fc.float({ noNaN: true, min: -2, max: 2 })
      }),
      { minLength: 0, maxLength: 6 }
    )
    fc.assert(
      fc.property(loraArb, loraArb, (rawA, rawB) => {
        const a = uniqueByName(rawA)
        const b = uniqueByName(rawB)
        const baseline = diffLoras(a, b)
        // Permute A
        const shuffledA = [...a].reverse()
        expect(diffLoras(shuffledA, b)).toEqual(baseline)
        // Permute B
        const shuffledB = [...b].reverse()
        expect(diffLoras(a, shuffledB)).toEqual(baseline)
        // Permute BOTH
        expect(diffLoras(shuffledA, shuffledB)).toEqual(baseline)
      }),
      { numRuns: 50 }
    )
  })

  it('is permutation-invariant under random shuffle (fc.shuffledSubarray)', () => {
    const loraArb = fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 4 }),
        weight: fc.float({ noNaN: true, min: -2, max: 2 })
      }),
      { minLength: 0, maxLength: 6 }
    )
    fc.assert(
      fc.property(loraArb, loraArb, (rawA, rawB) => {
        const a = uniqueByName(rawA)
        const b = uniqueByName(rawB)
        const baseline = diffLoras(a, b)
        const shuffledA =
          a.length > 0
            ? fc.sample(
                fc.shuffledSubarray(a, {
                  minLength: a.length,
                  maxLength: a.length
                }),
                1
              )[0]
            : a
        const shuffledB =
          b.length > 0
            ? fc.sample(
                fc.shuffledSubarray(b, {
                  minLength: b.length,
                  maxLength: b.length
                }),
                1
              )[0]
            : b
        expect(diffLoras(shuffledA, shuffledB)).toEqual(baseline)
      }),
      { numRuns: 50 }
    )
  })
})

describe('pure-module invariants', () => {
  it("metadataDiff.ts has no vue / pinia / '@/' runtime imports", () => {
    // Resolve relative to repo root via process.cwd() — happy-dom strips
    // import.meta.url's file: scheme (see Plan 05-01 SUMMARY, Deviation 1).
    const source = readFileSync(
      resolvePath(
        process.cwd(),
        'src/platform/moshpit/services/metadataDiff.ts'
      ),
      'utf8'
    )
    // Strip import-type lines which are erased at build time and are always
    // safe.
    const runtimeOnly = source
      .split('\n')
      .filter((l) => !/^\s*import\s+type\s/.test(l))
      .join('\n')
    expect(runtimeOnly).not.toMatch(/from\s+['"]vue['"]/)
    expect(runtimeOnly).not.toMatch(/from\s+['"]pinia['"]/)
    expect(runtimeOnly).not.toMatch(/from\s+['"]@\//)
  })

  it('imports NormalizedParams as a type-only import', () => {
    const source = readFileSync(
      resolvePath(
        process.cwd(),
        'src/platform/moshpit/services/metadataDiff.ts'
      ),
      'utf8'
    )
    expect(source).toMatch(
      /import type\s+\{[^}]*NormalizedParams[^}]*\}\s+from\s+['"]\.\/paramNormalize['"]/
    )
  })
})
