/**
 * Phase 5 Plan 01 — RED tests for the pure tournament bracket module.
 *
 * Covers decisions D-01..D-09 (see 05-CONTEXT.md):
 *   - D-01 adaptive bracket shape (round-robin for N<8, single-elim for N>=8)
 *   - D-02 deterministic seed order = selection order
 *   - D-03 skip semantics (round-robin re-queue, single-elim bye for seed A)
 *   - D-06 winner-set rules (round-robin top-N with ties, single-elim champion)
 *
 * This file is the behavioural spec — Task 2 GREEN implements against it.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  ROUND_ROBIN_THRESHOLD,
  applyPick,
  applySkip,
  computeWinnerSet,
  decideBracketShape,
  generateInitialBracket,
  generateNextRound
} from './tournamentBracket'
import type { BracketShape, TournamentPair } from './tournamentBracket'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertPair(pair: TournamentPair, partial: Partial<TournamentPair>) {
  for (const key of Object.keys(partial) as (keyof TournamentPair)[]) {
    expect(pair[key]).toBe(partial[key])
  }
}

function hashes(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `h${i}`)
}

// ---------------------------------------------------------------------------
// decideBracketShape (D-01)
// ---------------------------------------------------------------------------

describe('decideBracketShape (D-01)', () => {
  it('exports the tunable threshold constant as 8', () => {
    expect(ROUND_ROBIN_THRESHOLD).toBe(8)
  })

  it('returns roundRobin for n in {2,3,4,5,6,7}', () => {
    for (const n of [2, 3, 4, 5, 6, 7]) {
      expect(decideBracketShape(n)).toBe<BracketShape>('roundRobin')
    }
  })

  it('returns singleElim for n in {8,9,16,32}', () => {
    for (const n of [8, 9, 16, 32]) {
      expect(decideBracketShape(n)).toBe<BracketShape>('singleElim')
    }
  })

  it('property: roundRobin iff n < 8 for n in [2,64]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 64 }), (n) => {
        const shape = decideBracketShape(n)
        if (n < 8) expect(shape).toBe<BracketShape>('roundRobin')
        else expect(shape).toBe<BracketShape>('singleElim')
      }),
      { numRuns: 50 }
    )
  })
})

// ---------------------------------------------------------------------------
// generateInitialBracket — round-robin (D-02 / D-05)
// ---------------------------------------------------------------------------

describe('generateInitialBracket — round-robin', () => {
  it('n=4 produces 6 pairs in lex seed order with total=6', () => {
    const pairs = generateInitialBracket(['a', 'b', 'c', 'd'], 'roundRobin')
    expect(pairs).toHaveLength(6)
    for (const p of pairs) expect(p.total).toBe(6)

    const expected = [
      { seedA: 0, seedB: 1, assetHashA: 'a', assetHashB: 'b', index: 0 },
      { seedA: 0, seedB: 2, assetHashA: 'a', assetHashB: 'c', index: 1 },
      { seedA: 0, seedB: 3, assetHashA: 'a', assetHashB: 'd', index: 2 },
      { seedA: 1, seedB: 2, assetHashA: 'b', assetHashB: 'c', index: 3 },
      { seedA: 1, seedB: 3, assetHashA: 'b', assetHashB: 'd', index: 4 },
      { seedA: 2, seedB: 3, assetHashA: 'c', assetHashB: 'd', index: 5 }
    ]
    pairs.forEach((p, i) => assertPair(p, expected[i]))
  })

  it('property (n ∈ [2,7]): completeness — every unordered pair appears exactly once', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 7 }), (n) => {
        const input = hashes(n)
        const pairs = generateInitialBracket(input, 'roundRobin')
        expect(pairs).toHaveLength((n * (n - 1)) / 2)

        const seen = new Set<string>()
        for (const p of pairs) {
          const lo = Math.min(p.seedA, p.seedB)
          const hi = Math.max(p.seedA, p.seedB)
          seen.add(`${lo}-${hi}`)
          expect(p.total).toBe((n * (n - 1)) / 2)
        }
        expect(seen.size).toBe((n * (n - 1)) / 2)

        const indexes = pairs.map((p) => p.index).sort((a, b) => a - b)
        const expectedIndexes = Array.from(
          { length: pairs.length },
          (_, i) => i
        )
        expect(indexes).toEqual(expectedIndexes)
      }),
      { numRuns: 30 }
    )
  })
})

// ---------------------------------------------------------------------------
// generateInitialBracket — single-elim (D-01)
// ---------------------------------------------------------------------------

describe('generateInitialBracket — single-elim', () => {
  it('n=8 produces 4 initial-round pairs with total=7', () => {
    const pairs = generateInitialBracket(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      'singleElim'
    )
    expect(pairs).toHaveLength(4)
    for (const p of pairs) expect(p.total).toBe(7)
    assertPair(pairs[0], {
      seedA: 0,
      seedB: 1,
      assetHashA: 'a',
      assetHashB: 'b',
      index: 0
    })
    assertPair(pairs[1], {
      seedA: 2,
      seedB: 3,
      assetHashA: 'c',
      assetHashB: 'd',
      index: 1
    })
    assertPair(pairs[2], {
      seedA: 4,
      seedB: 5,
      assetHashA: 'e',
      assetHashB: 'f',
      index: 2
    })
    assertPair(pairs[3], {
      seedA: 6,
      seedB: 7,
      assetHashA: 'g',
      assetHashB: 'h',
      index: 3
    })
  })

  it('n=10 — byes go to first 6 seeds; initial queue pairs un-byed seeds', () => {
    // nextPow2(10) = 16, byes = 16 - 10 = 6. First 6 seeds (0..5) receive
    // walkover byes; seeds 6..9 are paired consecutively: (6,7) and (8,9).
    // Initial queue length MUST be 2.
    const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const pairs = generateInitialBracket(input, 'singleElim')
    expect(pairs).toHaveLength(2)
    for (const p of pairs) expect(p.total).toBe(9) // N-1 = 9
    assertPair(pairs[0], {
      seedA: 6,
      seedB: 7,
      assetHashA: 'g',
      assetHashB: 'h',
      index: 0
    })
    assertPair(pairs[1], {
      seedA: 8,
      seedB: 9,
      assetHashA: 'i',
      assetHashB: 'j',
      index: 1
    })
  })
})

// ---------------------------------------------------------------------------
// applyPick
// ---------------------------------------------------------------------------

describe('applyPick', () => {
  it('round-robin: picking A increments winner hash by 1; queueTail empty', () => {
    const pair: TournamentPair = {
      seedA: 0,
      seedB: 1,
      assetHashA: 'a',
      assetHashB: 'b',
      index: 0,
      total: 6
    }
    const result = applyPick(
      new Map<string, number>(),
      pair,
      'A',
      'roundRobin',
      []
    )
    expect(result.wins.get('a')).toBe(1)
    expect(result.wins.get('b')).toBeUndefined()
    expect(result.queueTail).toEqual([])
  })

  it('round-robin: three picks accumulate correctly', () => {
    const p0: TournamentPair = {
      seedA: 0,
      seedB: 1,
      assetHashA: 'a',
      assetHashB: 'b',
      index: 0,
      total: 6
    }
    const p1: TournamentPair = {
      seedA: 0,
      seedB: 2,
      assetHashA: 'a',
      assetHashB: 'c',
      index: 1,
      total: 6
    }
    const p2: TournamentPair = {
      seedA: 1,
      seedB: 2,
      assetHashA: 'b',
      assetHashB: 'c',
      index: 3,
      total: 6
    }
    const r1 = applyPick(new Map(), p0, 'A', 'roundRobin', [])
    const r2 = applyPick(r1.wins, p1, 'B', 'roundRobin', [])
    const r3 = applyPick(r2.wins, p2, 'A', 'roundRobin', [])
    expect(r3.wins.get('a')).toBe(1)
    expect(r3.wins.get('b')).toBe(1)
    expect(r3.wins.get('c')).toBe(1)
  })

  it('single-elim: applyPick returns queueTail=[]; generateNextRound produces the next pair (n=4)', () => {
    // Initial queue = [(0,1), (2,3)]
    const pair0: TournamentPair = {
      seedA: 0,
      seedB: 1,
      assetHashA: 'a',
      assetHashB: 'b',
      index: 0,
      total: 3
    }
    const pair1: TournamentPair = {
      seedA: 2,
      seedB: 3,
      assetHashA: 'c',
      assetHashB: 'd',
      index: 1,
      total: 3
    }
    const r1 = applyPick(new Map(), pair0, 'A', 'singleElim', [pair1])
    expect(r1.wins.get('a')).toBe(1)
    expect(r1.queueTail).toEqual([])

    const r2 = applyPick(r1.wins, pair1, 'A', 'singleElim', [])
    expect(r2.wins.get('a')).toBe(1)
    expect(r2.wins.get('c')).toBe(1)
    expect(r2.queueTail).toEqual([])

    // Round boundary: caller passes the ordered winner list to generateNextRound.
    const nextRound = generateNextRound(['a', 'c'], 3, 2)
    expect(nextRound).toHaveLength(1)
    const [p] = nextRound
    expect(p.assetHashA).toBe('a')
    expect(p.assetHashB).toBe('c')
    expect(p.index).toBe(2)
    expect(p.total).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// applySkip (D-03)
// ---------------------------------------------------------------------------

describe('applySkip', () => {
  it('round-robin: re-queue idempotency property (n ∈ [2,6])', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 0, max: 100 }),
        (n, seed) => {
          const input = hashes(n)
          const initial = generateInitialBracket(input, 'roundRobin')

          // Deterministic "user" sequence: alternating pick-A / skip-then-pick-A.
          // Reference run: pick 'A' on every pair in order, no skips.
          let refWins = new Map<string, number>()
          for (const p of initial) {
            const r = applyPick(refWins, p, 'A', 'roundRobin', [])
            refWins = new Map(r.wins)
          }

          // Skip-run: for each pair, if (seed + index) % 2 === 0 skip first,
          // re-queue, then come back to it later; else pick 'A'.
          let queue: readonly TournamentPair[] = [...initial]
          let skipIdx = new Set<number>()
          let wins = new Map<string, number>()
          let guard = 0
          const MAX_ITER = initial.length * 4 + 10
          while (queue.length > 0 && guard < MAX_ITER) {
            guard += 1
            const [head, ...rest] = queue
            const shouldSkip =
              !skipIdx.has(head.index) && (seed + head.index) % 2 === 0
            if (shouldSkip) {
              const s = applySkip(head, rest, skipIdx, wins, 'roundRobin')
              queue = s.nextQueue
              skipIdx = new Set(s.skippedPairIndexes)
              wins = new Map(s.wins)
            } else {
              const r = applyPick(wins, head, 'A', 'roundRobin', rest)
              wins = new Map(r.wins)
              queue = rest
            }
          }
          expect(queue.length).toBe(0)
          // Final wins map MUST equal the reference run's — skip is a detour,
          // not a state change on the wins map.
          for (const h of input) {
            expect(wins.get(h) ?? 0).toBe(refWins.get(h) ?? 0)
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  it('round-robin: skipping moves pair to tail of queue', () => {
    const input = ['a', 'b', 'c']
    const initial = generateInitialBracket(input, 'roundRobin')
    const [head, ...rest] = initial
    const result = applySkip(head, rest, new Set(), new Map(), 'roundRobin')
    expect(result.nextQueue).toHaveLength(initial.length)
    expect(result.nextQueue[result.nextQueue.length - 1]).toEqual(head)
    expect(result.skippedPairIndexes.has(head.index)).toBe(true)
    // No wins recorded for round-robin skip
    expect(result.wins.size).toBe(0)
  })

  it('single-elim: records skip index AND bye-advances seed A (D-03)', () => {
    const pair: TournamentPair = {
      seedA: 0,
      seedB: 1,
      assetHashA: 'a',
      assetHashB: 'b',
      index: 0,
      total: 3
    }
    const result = applySkip(pair, [], new Set(), new Map(), 'singleElim')
    expect(result.skippedPairIndexes.has(0)).toBe(true)
    expect(result.wins.get('a')).toBe(1)
    expect(result.wins.get('b')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// computeWinnerSet (D-06)
// ---------------------------------------------------------------------------

describe('computeWinnerSet', () => {
  it('round-robin: top-3 with ties at 3rd-place promoted', () => {
    const wins = new Map<string, number>([
      ['a', 3],
      ['b', 2],
      ['c', 2],
      ['d', 2],
      ['e', 1],
      ['f', 0]
    ])
    const result = computeWinnerSet(wins, 'roundRobin', [
      'a',
      'b',
      'c',
      'd',
      'e',
      'f'
    ])
    // a (3), then all tied at 2 (b,c,d in entry order) — promoted ties.
    expect(result).toEqual(['a', 'b', 'c', 'd'])
  })

  it('round-robin: no wins at all -> empty winner set', () => {
    const wins = new Map<string, number>([
      ['a', 0],
      ['b', 0],
      ['c', 0]
    ])
    const result = computeWinnerSet(wins, 'roundRobin', ['a', 'b', 'c'])
    expect(result).toEqual([])
  })

  it('round-robin: sort by wins desc, tie-break by entry order', () => {
    const wins = new Map<string, number>([
      ['c', 3],
      ['a', 3],
      ['b', 1]
    ])
    // entry order = [a, b, c]; a and c tied at 3 — a first.
    const result = computeWinnerSet(wins, 'roundRobin', ['a', 'b', 'c'])
    expect(result).toEqual(['a', 'c', 'b'])
  })

  it('single-elim: single asset with max wins is champion', () => {
    // n=4 single-elim: winner has 2 wins (round1 + final).
    const wins = new Map<string, number>([
      ['a', 2],
      ['c', 1],
      ['b', 0],
      ['d', 0]
    ])
    const result = computeWinnerSet(wins, 'singleElim', ['a', 'b', 'c', 'd'])
    expect(result).toEqual(['a'])
  })

  it('single-elim: abandoned bracket falls back to top-1 by wins', () => {
    // Partial bracket (abandoned): only a has any wins.
    const wins = new Map<string, number>([
      ['a', 1],
      ['b', 0],
      ['c', 0],
      ['d', 0]
    ])
    const result = computeWinnerSet(wins, 'singleElim', ['a', 'b', 'c', 'd'])
    expect(result).toEqual(['a'])
  })

  it('single-elim: multi-way tie at max -> entry-order tie-break, single element', () => {
    const wins = new Map<string, number>([
      ['c', 1],
      ['a', 1],
      ['b', 1]
    ])
    const result = computeWinnerSet(wins, 'singleElim', ['a', 'b', 'c'])
    expect(result).toEqual(['a'])
  })

  it('single-elim: empty wins map returns []', () => {
    const result = computeWinnerSet(new Map(), 'singleElim', [
      'a',
      'b',
      'c',
      'd'
    ])
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Pure-module invariant — tournamentBracket.ts MUST have zero runtime imports
// from vue/pinia/@/... (worker-safe constraint).
// ---------------------------------------------------------------------------

describe('pure-module invariants', () => {
  it("tournamentBracket.ts has no vue / pinia / '@/' imports", () => {
    // Resolve relative to repo root via process.cwd() — happy-dom strips
    // import.meta.url's file: scheme and fileURLToPath rejects it.
    const source = readFileSync(
      resolvePath(
        process.cwd(),
        'src/platform/moshpit/services/tournamentBracket.ts'
      ),
      'utf8'
    )
    expect(source).not.toMatch(/from ['"]vue['"]/)
    expect(source).not.toMatch(/from ['"]pinia['"]/)
    expect(source).not.toMatch(/from ['"]@\//)
  })
})
