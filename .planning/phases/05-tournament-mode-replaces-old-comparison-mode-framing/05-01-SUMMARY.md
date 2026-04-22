---
phase: 05
plan: 01
subsystem: moshpit-tournament
tags: [moshpit, tournament, pure-math, tdd, fast-check]
requires: []
provides:
  - 'decideBracketShape(n): BracketShape'
  - 'generateInitialBracket(hashes, shape): readonly TournamentPair[]'
  - 'applyPick(wins, pair, winner, shape, remainingQueueAfterThis): BracketUpdate'
  - 'generateNextRound(winnersInOrder, totalPicksExpected, baseIndex): readonly TournamentPair[]'
  - 'applySkip(pair, remainingQueueAfterThis, skippedPairIndexes, wins, shape): SkipUpdate'
  - 'computeWinnerSet(wins, shape, hashesInEntryOrder, topN?): readonly string[]'
affects: []
tech-stack:
  added: []
  patterns:
    - 'Pure worker-safe service module (mirrors groupAxes.ts / clusterLayout.ts)'
    - 'fast-check property tests for bracket completeness and skip idempotency'
key-files:
  created:
    - 'src/platform/moshpit/services/tournamentBracket.ts'
    - 'src/platform/moshpit/services/tournamentBracket.test.ts'
  modified: []
decisions:
  - 'Locked applyPick to always return { wins, queueTail: [] } — next-round generation lives in generateNextRound, keeping applyPick total and local.'
  - 'Pure-module invariant verified at test time via readFileSync + regex; resolved via process.cwd() because happy-dom strips the file: scheme from import.meta.url.'
  - 'RED commit ships a stub tournamentBracket.ts exporting the API names with notImplemented() throwers so ESLint import-x/no-unresolved does not block the TDD RED commit.'
metrics:
  duration: ~30min
  completed: 2026-04-22
  tasks: 2
  files: 2
  commits:
    - '56b2e1ffe test(05-01): add failing bracket generator + winner-set tests'
    - 'b0559f78f feat(05-01): implement tournament bracket pure module'
---

# Phase 5 Plan 01: Tournament Bracket Pure Module Summary

Deterministic round-robin / single-elim bracket math with fast-check property coverage — the core game-logic substrate for Plan 03's tournament store.

## Final API Surface

```typescript
export type BracketShape = 'roundRobin' | 'singleElim'
export const ROUND_ROBIN_THRESHOLD = 8

export interface TournamentPair {
  readonly seedA: number
  readonly seedB: number
  readonly assetHashA: string
  readonly assetHashB: string
  readonly index: number
  readonly total: number
}

export interface BracketUpdate {
  readonly wins: ReadonlyMap<string, number>
  readonly queueTail: readonly TournamentPair[] // always []
}

export interface SkipUpdate {
  readonly nextQueue: readonly TournamentPair[]
  readonly skippedPairIndexes: ReadonlySet<number>
  readonly wins: ReadonlyMap<string, number>
}

export function decideBracketShape(n: number): BracketShape
export function generateInitialBracket(
  hashes: readonly string[],
  shape: BracketShape
): readonly TournamentPair[]
export function applyPick(
  wins: ReadonlyMap<string, number>,
  pair: TournamentPair,
  winner: 'A' | 'B',
  shape: BracketShape,
  remainingQueueAfterThis: readonly TournamentPair[]
): BracketUpdate
export function generateNextRound(
  currentRoundWinnersInOrder: readonly string[],
  totalPicksExpected: number,
  baseIndex: number
): readonly TournamentPair[]
export function applySkip(
  pair: TournamentPair,
  remainingQueueAfterThis: readonly TournamentPair[],
  skippedPairIndexes: ReadonlySet<number>,
  wins: ReadonlyMap<string, number>,
  shape: BracketShape
): SkipUpdate
export function computeWinnerSet(
  wins: ReadonlyMap<string, number>,
  shape: BracketShape,
  hashesInEntryOrder: readonly string[],
  topN?: number
): readonly string[]
```

## Signature Deviations from Plan `<interfaces>`

None of substance. The locked plan contract already carved `generateNextRound`
out of `applyPick` explicitly — both functions are shipped as specified.

Unused parameter suppressions: `applyPick` receives `_shape` and
`_remainingQueueAfterThis` but does not consume them (they're retained in the
signature for future-compat and because the plan's locked contract requires
them to be passable from the store). The underscore-prefix convention
satisfies oxlint/eslint.

## Test Coverage (22 tests, 6 fast-check properties)

| Describe block                       | Tests | Notes                                                          |
| ------------------------------------ | ----- | -------------------------------------------------------------- |
| decideBracketShape (D-01)            | 4     | Includes property test across n ∈ [2,64]                       |
| generateInitialBracket — round-robin | 2     | n=4 concrete + completeness property for n ∈ [2,7]             |
| generateInitialBracket — single-elim | 2     | n=8 concrete + n=10 bye behaviour                              |
| applyPick                            | 3     | Round-robin accumulation + single-elim handoff to generateNext |
| applySkip (D-03)                     | 3     | Re-queue idempotency property + structural + single-elim bye   |
| computeWinnerSet (D-06)              | 7     | Round-robin ties-promote + single-elim champion + fallbacks    |
| pure-module invariants               | 1     | Regex scan of on-disk source                                   |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pure-module invariant test failed under happy-dom**

- **Found during:** Task 2 GREEN verification
- **Issue:** `fileURLToPath(new URL('./tournamentBracket.ts', import.meta.url))` threw `TypeError: The URL must be of scheme file` because happy-dom returns a non-`file:` URL for `import.meta.url`.
- **Fix:** Replaced with `readFileSync(resolve(process.cwd(), 'src/platform/moshpit/services/tournamentBracket.ts'), 'utf8')`. Vitest runs with cwd at repo root, so this resolves correctly in both node and happy-dom.
- **Files modified:** `src/platform/moshpit/services/tournamentBracket.test.ts`
- **Commit:** Folded into `b0559f78f`

**2. [Rule 3 - Blocking] ESLint `import-x/no-unresolved` blocked the pure RED commit**

- **Found during:** Task 1 RED commit
- **Issue:** husky's pre-commit ESLint step failed because the test file imported from a file that did not yet exist; the commit was rejected outright (working tree kept, but no commit landed — the Phase 4 note about lint-staged "only reverting the staged index" did not hold here).
- **Fix:** Added a minimal stub `tournamentBracket.ts` exporting the API names with `notImplemented()` throwers. ESLint resolves the import; runtime behaviour is still fully RED (21 of 22 tests fail with "not implemented" errors; only the pure-module-string-scan test passes because the stub has no forbidden imports).
- **Files modified:** `src/platform/moshpit/services/tournamentBracket.ts`
- **Commit:** Folded into RED commit `56b2e1ffe`

No architectural changes required. No auth gates encountered.

## fast-check Seeds / Notable Invariants

Property tests use default fast-check shrinking. No non-obvious counterexamples surfaced during development. Key invariants proved:

1. **Round-robin completeness (n ∈ [2,7]):** For any n, every unordered pair (i,j) with i<j appears exactly once; `pair.index` is a permutation of `[0..n*(n-1)/2)`.
2. **Skip → re-queue idempotency (n ∈ [2,6]):** Regardless of which pairs are skipped and when, the final wins map after all pairs have been picked 'A' equals the wins map of the skip-free reference run. Seed iteration drives the skip decision deterministically.
3. **decideBracketShape:** Threshold is strict `<` against `ROUND_ROBIN_THRESHOLD = 8`.

## Notes for Plan 03 Executor (moshpitTournamentStore)

On `enter(selection)`:

```typescript
const hashes = selection // array from moshpitSelectionStore.selected
const shape = decideBracketShape(hashes.length)
const queue = generateInitialBracket(hashes, shape)
// state: bracket = queue, wins = new Map(), skippedPairIndexes = new Set()
```

On pick:

```typescript
const { wins } = applyPick(currentWins, head, winner, shape, rest)
// queueTail is ALWAYS [] — ignore it. Advance cursor by 1.
// For single-elim: when the current round is fully picked (track
// currentRoundWinnersInOrder), call generateNextRound(winners, totalPicksExpected, nextIndex)
// and append its pairs to the queue.
```

On skip:

```typescript
const { nextQueue, skippedPairIndexes, wins } = applySkip(
  head,
  rest,
  currentSkipped,
  currentWins,
  shape
)
// Round-robin: queue is rotated. Single-elim: seed A is bye-advanced AND
// the pair.index is recorded in skippedPairIndexes so the store can flag
// seed B as "no-decision" (D-03 semantics).
```

On exit:

```typescript
const winners = computeWinnerSet(wins, shape, originalSelectionOrder)
if (winners.length === 0) {
  // D-07 — preserve selection, toast "no winners"
} else {
  moshpitSelectionStore.setSelection(winners)
}
```

## Self-Check: PASSED

- src/platform/moshpit/services/tournamentBracket.ts — FOUND
- src/platform/moshpit/services/tournamentBracket.test.ts — FOUND
- Commit 56b2e1ffe (RED) — FOUND
- Commit b0559f78f (GREEN) — FOUND
- All 22 tests pass under `pnpm test:unit -- --run src/platform/moshpit/services/tournamentBracket.test.ts`
- Pure-module invariant: no vue / pinia / `@/` imports in `tournamentBracket.ts`
