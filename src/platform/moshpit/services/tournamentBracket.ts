/**
 * Phase 5 Plan 01 — pure tournament bracket module (CONTEXT.md D-01..D-09).
 *
 * Pure, worker-safe module: no Vue, no Pinia, no DOM, no `@/` imports. Safe to
 * evaluate inside a worker — the future v2-TOUR-01 offline elo pipeline
 * can consume this module byte-identically.
 *
 * Responsibilities:
 *   1. Decide bracket shape from selection size N (D-01).
 *   2. Generate the initial pair queue deterministically from an ordered
 *      hash list (D-02).
 *   3. Fold pick / skip events into a wins map (D-03) — the store owns the
 *      live queue and round-boundary detection.
 *   4. Derive the winner set at exit (D-06).
 *
 * Signature constraints are LOCKED by 05-01-PLAN.md <interfaces>. The RED
 * tests in tournamentBracket.test.ts are the behavioural spec.
 */

// ---------------------------------------------------------------------------
// Types + constants
// ---------------------------------------------------------------------------

export type BracketShape = 'roundRobin' | 'singleElim'

/** D-01: round-robin when N < threshold, single-elim when N >= threshold. */
export const ROUND_ROBIN_THRESHOLD = 8

export interface TournamentPair {
  readonly seedA: number
  readonly seedB: number
  readonly assetHashA: string
  readonly assetHashB: string
  /** 0-based position in the bracket timeline (unique across rounds). */
  readonly index: number
  /**
   * Round-robin: total pairs in the bracket (N*(N-1)/2).
   * Single-elim: total picks expected for the whole bracket (N-1).
   */
  readonly total: number
}

export interface BracketUpdate {
  readonly wins: ReadonlyMap<string, number>
  /**
   * LOCKED CONTRACT: always empty. Next-round generation for single-elim lives
   * in `generateNextRound`; the store (Plan 03) tracks the current round's
   * winners and calls `generateNextRound` at the round boundary.
   */
  readonly queueTail: readonly TournamentPair[]
}

export interface SkipUpdate {
  readonly nextQueue: readonly TournamentPair[]
  readonly skippedPairIndexes: ReadonlySet<number>
  readonly wins: ReadonlyMap<string, number>
}

// ---------------------------------------------------------------------------
// decideBracketShape (D-01)
// ---------------------------------------------------------------------------

export function decideBracketShape(n: number): BracketShape {
  return n < ROUND_ROBIN_THRESHOLD ? 'roundRobin' : 'singleElim'
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function nextPow2(n: number): number {
  if (n <= 1) return 1
  return 1 << Math.ceil(Math.log2(n))
}

// ---------------------------------------------------------------------------
// generateInitialBracket (D-02)
// ---------------------------------------------------------------------------

export function generateInitialBracket(
  hashes: readonly string[],
  shape: BracketShape
): readonly TournamentPair[] {
  const n = hashes.length
  if (n < 2) return []

  if (shape === 'roundRobin') {
    const total = (n * (n - 1)) / 2
    const pairs: TournamentPair[] = []
    let index = 0
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push({
          seedA: i,
          seedB: j,
          assetHashA: hashes[i],
          assetHashB: hashes[j],
          index,
          total
        })
        index += 1
      }
    }
    return pairs
  }

  // single-elim: byes to first (nextPow2(N) - N) seeds; pair remaining seeds
  // consecutively. total = N - 1 picks across the whole bracket.
  const total = n - 1
  const byeCount = nextPow2(n) - n
  const pairs: TournamentPair[] = []
  let index = 0
  for (let seed = byeCount; seed < n - 1; seed += 2) {
    pairs.push({
      seedA: seed,
      seedB: seed + 1,
      assetHashA: hashes[seed],
      assetHashB: hashes[seed + 1],
      index,
      total
    })
    index += 1
  }
  return pairs
}

// ---------------------------------------------------------------------------
// applyPick
// ---------------------------------------------------------------------------

function incrementWin(
  wins: ReadonlyMap<string, number>,
  hash: string
): Map<string, number> {
  const next = new Map(wins)
  next.set(hash, (next.get(hash) ?? 0) + 1)
  return next
}

export function applyPick(
  wins: ReadonlyMap<string, number>,
  pair: TournamentPair,
  winner: 'A' | 'B',
  _shape: BracketShape,
  _remainingQueueAfterThis: readonly TournamentPair[]
): BracketUpdate {
  const winnerHash = winner === 'A' ? pair.assetHashA : pair.assetHashB
  return {
    wins: incrementWin(wins, winnerHash),
    queueTail: []
  }
}

// ---------------------------------------------------------------------------
// generateNextRound (single-elim round boundary)
// ---------------------------------------------------------------------------

export function generateNextRound(
  currentRoundWinnersInOrder: readonly string[],
  totalPicksExpected: number,
  baseIndex: number
): readonly TournamentPair[] {
  const winners = currentRoundWinnersInOrder
  const pairs: TournamentPair[] = []
  for (let i = 0; i + 1 < winners.length; i += 2) {
    pairs.push({
      seedA: i,
      seedB: i + 1,
      assetHashA: winners[i],
      assetHashB: winners[i + 1],
      index: baseIndex + pairs.length,
      total: totalPicksExpected
    })
  }
  return pairs
}

// ---------------------------------------------------------------------------
// applySkip (D-03)
// ---------------------------------------------------------------------------

export function applySkip(
  pair: TournamentPair,
  remainingQueueAfterThis: readonly TournamentPair[],
  skippedPairIndexes: ReadonlySet<number>,
  wins: ReadonlyMap<string, number>,
  shape: BracketShape
): SkipUpdate {
  const nextSkip = new Set(skippedPairIndexes)
  nextSkip.add(pair.index)

  if (shape === 'roundRobin') {
    return {
      nextQueue: [...remainingQueueAfterThis, pair],
      skippedPairIndexes: nextSkip,
      wins
    }
  }

  // single-elim: skip bye-advances seed A AND records the pair in skippedPairs
  // so the store can flag seed B as no-decision (D-03).
  return {
    nextQueue: remainingQueueAfterThis,
    skippedPairIndexes: nextSkip,
    wins: incrementWin(wins, pair.assetHashA)
  }
}

// ---------------------------------------------------------------------------
// computeWinnerSet (D-06)
// ---------------------------------------------------------------------------

function sortByWinsThenEntryOrder(
  wins: ReadonlyMap<string, number>,
  hashesInEntryOrder: readonly string[]
): Array<{ hash: string; wins: number; entryIndex: number }> {
  const entryIndex = new Map<string, number>()
  hashesInEntryOrder.forEach((h, i) => entryIndex.set(h, i))

  const rows = hashesInEntryOrder
    .map((hash) => ({
      hash,
      wins: wins.get(hash) ?? 0,
      entryIndex: entryIndex.get(hash) ?? Number.MAX_SAFE_INTEGER
    }))
    // Also include hashes present in `wins` but missing from entryOrder —
    // defensive, shouldn't happen but keeps the function total.
    .concat(
      [...wins.keys()]
        .filter((h) => !entryIndex.has(h))
        .map((hash) => ({
          hash,
          wins: wins.get(hash) ?? 0,
          entryIndex: Number.MAX_SAFE_INTEGER
        }))
    )

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.entryIndex - b.entryIndex
  })
  return rows
}

export function computeWinnerSet(
  wins: ReadonlyMap<string, number>,
  shape: BracketShape,
  hashesInEntryOrder: readonly string[],
  topN: number = 3
): readonly string[] {
  const sorted = sortByWinsThenEntryOrder(wins, hashesInEntryOrder)
  const withWins = sorted.filter((r) => r.wins > 0)

  if (withWins.length === 0) return []

  if (shape === 'singleElim') {
    // Champion = single hash with max wins; multi-way ties broken by entry
    // order. Abandoned brackets fall back to the top-1 by the same rule.
    return [withWins[0].hash]
  }

  // round-robin: top-N including all ties at the N-th-place win count.
  if (withWins.length <= topN) {
    return withWins.map((r) => r.hash)
  }
  const cutoffWins = withWins[topN - 1].wins
  const promoted = withWins.filter((r) => r.wins >= cutoffWins)
  return promoted.map((r) => r.hash)
}
