---
phase: quick-260423-dum
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/platform/moshpit/services/tournamentBracket.ts
  - src/platform/moshpit/services/tournamentBracket.test.ts
  - src/platform/moshpit/stores/moshpitTournamentStore.ts
  - src/platform/moshpit/stores/moshpitTournamentStore.test.ts
  - src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts
autonomous: true
requirements:
  - TOUR-01 # single-elim bracket must actually include all entered assets
  - TOUR-03 # pick/skip semantics must be correct across round boundaries
  - D-01 # single-elim shape for N >= 8 (from Phase 05 CONTEXT)
  - D-03 # skip semantics — bye forwarding must work for skip() too

must_haves:
  truths:
    - 'A bye seed (first nextPow2(N) - N seeds) advances to round 2 and can actually compete.'
    - 'For N=9, all 9 entered assets participate across the full bracket (8 total picks expected: N-1 = 8).'
    - 'For N=10, all 10 entered assets participate; bracket length reaches 9 total pairs.'
    - 'For N=11, all 11 entered assets participate; bracket length reaches 10 total pairs.'
    - 'For N=16 (power of 2 — no byes) behaviour is unchanged vs the pre-fix code.'
    - 'A bye-seeded asset can win the whole tournament (winnerHashes returns that hash when it wins every round).'
    - 'skip() in round 1 of a byed bracket still forms round 2 correctly with byes prepended.'
    - "Pure module tournamentBracket.ts remains worker-safe (no vue / pinia / '@/' imports)."
  artifacts:
    - path: 'src/platform/moshpit/services/tournamentBracket.ts'
      provides: 'computeByeHashes public export; bye-count math lives here.'
      exports: ['computeByeHashes']
    - path: 'src/platform/moshpit/stores/moshpitTournamentStore.ts'
      provides: 'pendingByeHashes internal ref; bye-forwarding in pickWinner + skip round boundaries.'
      contains: 'computeByeHashes'
    - path: 'src/platform/moshpit/services/tournamentBracket.test.ts'
      provides: 'computeByeHashes test coverage; existing n=10 test retained (still valid for the pure module).'
    - path: 'src/platform/moshpit/stores/moshpitTournamentStore.test.ts'
      provides: 'N=9/10/11/16 end-to-end bracket-length coverage; bye-champion case; skip-with-byes case; exit/re-enter leak check.'
    - path: 'src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts'
      provides: 'N=10 round-column regression guard ([2,4,2,1] pair counts across 4 rounds).'
  key_links:
    - from: 'moshpitTournamentStore.ts#enter'
      to: 'tournamentBracket.ts#computeByeHashes'
      via: 'direct function call, result stored in pendingByeHashes ref'
      pattern: "computeByeHashes\\(selection, shape\\)"
    - from: 'moshpitTournamentStore.ts#pickWinner round-boundary branch'
      to: 'tournamentBracket.ts#generateNextRound'
      via: 'passes [...pendingByeHashes.value, ...currentRoundWinnersInOrder.value]'
      pattern: "generateNextRound\\("
    - from: 'moshpitTournamentStore.ts#skip single-elim round-boundary branch'
      to: 'tournamentBracket.ts#generateNextRound'
      via: 'same prepend-byes-then-winners pattern'
      pattern: "generateNextRound\\("
---

<objective>
Fix the single-elim bye bug in tournament bracket handling: bye seeds (the
first `nextPow2(N) - N` seeds when N is not a power of 2) currently never
compete, so for N=10 only 4 of 10 assets play. This plan forwards byes into
round 2 via a new pure-module helper (`computeByeHashes`) plus a store-side
state ref (`pendingByeHashes`) consumed at both the `pickWinner` and `skip`
round boundaries. Post-fix every entered asset participates and the bracket
size matches the textbook single-elim expectation (N - 1 total picks).

Purpose: Tournament mode is the v1 curation primitive. Silently dropping 60%
of the user's selection for N=10 violates TOUR-01 and the user's mental model
of "every image I picked gets a fair shot at the top". This is a shipped-bug
hotfix on a feature already signed off in UAT.

Output:

- `computeByeHashes(hashes, shape)` exported from the pure module
- `pendingByeHashes` internal ref on the tournament store, seeded in
  `enter()`, consumed + cleared on round-1 → round-2 transition in both
  `pickWinner` and `skip`, reset in `resetState()`
- New Vitest coverage for N=9/10/11/16, bye-champion, skip-with-byes,
  exit+re-enter leak check, and MoshpitTournamentBracketTree N=10 column
  counts
- Defensive invariant comment in `generateNextRound` documenting that
  `winners.length` must be even post-fix
  </objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/05-tournament-mode-replaces-old-comparison-mode-framing/05-CONTEXT.md

# The four files actually being edited

@src/platform/moshpit/services/tournamentBracket.ts
@src/platform/moshpit/services/tournamentBracket.test.ts
@src/platform/moshpit/stores/moshpitTournamentStore.ts
@src/platform/moshpit/stores/moshpitTournamentStore.test.ts

# Consumer of bracket shape for round-column sanity guard

@src/platform/moshpit/components/MoshpitTournamentBracketTree.vue
@src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts

<interfaces>
<!-- Current exported surface of the pure module. Task 1 adds computeByeHashes. -->

From src/platform/moshpit/services/tournamentBracket.ts:

```typescript
export type BracketShape = 'roundRobin' | 'singleElim'
export const ROUND_ROBIN_THRESHOLD: 8
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
  readonly queueTail: readonly TournamentPair[] // LOCKED: always []
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
  _shape: BracketShape,
  _remainingQueueAfterThis: readonly TournamentPair[]
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

// NEW (Task 1):
export function computeByeHashes(
  hashes: readonly string[],
  shape: BracketShape
): readonly string[]
```

Behavioural spec for computeByeHashes:

- `n < 2` → `[]` (match existing `generateInitialBracket` guard)
- `shape === 'roundRobin'` → `[]` (round-robin has no byes)
- `shape === 'singleElim'` and `n` is power of 2 → `[]`
- `shape === 'singleElim'` and `n` is not power of 2 → `hashes.slice(0, nextPow2(n) - n)`

Examples:

- N=8 singleElim → [] (byeCount = 16-8... wait, nextPow2(8)=8, so 8-8=0 → [])
- N=9 singleElim → hashes[0..6] (byeCount = 16-9 = 7)
- N=10 singleElim → hashes[0..5] (byeCount = 16-10 = 6)
- N=11 singleElim → hashes[0..4] (byeCount = 16-11 = 5)
- N=16 singleElim → []
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add computeByeHashes to the pure module + defensive invariant comment</name>
  <files>
    src/platform/moshpit/services/tournamentBracket.ts,
    src/platform/moshpit/services/tournamentBracket.test.ts
  </files>
  <behavior>
    New helper `computeByeHashes(hashes: readonly string[], shape: BracketShape): readonly string[]`:
    - N < 2 → []
    - shape === 'roundRobin' → []
    - shape === 'singleElim' and N is power of 2 → []
    - shape === 'singleElim' and N is not power of 2 → hashes.slice(0, nextPow2(N) - N)

    Existing n=10 test in tournamentBracket.test.ts stays valid — the comment
    at lines ~167-189 describes the pure module's behaviour (generate only
    the non-bye initial pairs); bye forwarding is the STORE's job, not the
    pure module's. Cross-reference via a new adjacent describe block that
    asserts computeByeHashes returns the first 6 seeds for the same N=10
    input. Update the n=10 test's explanatory comment to clarify that
    "walkover byes" are surfaced via the new computeByeHashes export, not
    via initial bracket pairs.

    Defensive invariant: add a comment in `generateNextRound` documenting
    that `winners.length` MUST be even when called post-fix. Keep existing
    loop behaviour unchanged (no throw, no warn — production is hot path,
    and the store-side fix guarantees evenness). Comment only.

  </behavior>
  <action>
    1. In tournamentBracket.test.ts, add RED describe block:

       ```ts
       describe('computeByeHashes', () => {
         it('N<2 returns []', () => {
           expect(computeByeHashes([], 'singleElim')).toEqual([])
           expect(computeByeHashes(['a'], 'singleElim')).toEqual([])
         })
         it('roundRobin always returns []', () => {
           expect(computeByeHashes(hashes(5), 'roundRobin')).toEqual([])
           expect(computeByeHashes(hashes(7), 'roundRobin')).toEqual([])
         })
         it('singleElim N=8 (power of 2) returns []', () => {
           expect(computeByeHashes(hashes(8), 'singleElim')).toEqual([])
         })
         it('singleElim N=16 (power of 2) returns []', () => {
           expect(computeByeHashes(hashes(16), 'singleElim')).toEqual([])
         })
         it('singleElim N=9 returns first 7 hashes (byeCount=16-9=7)', () => {
           expect(computeByeHashes(hashes(9), 'singleElim')).toEqual([
             'h0','h1','h2','h3','h4','h5','h6'
           ])
         })
         it('singleElim N=10 returns first 6 hashes (byeCount=16-10=6)', () => {
           expect(computeByeHashes(hashes(10), 'singleElim')).toEqual([
             'h0','h1','h2','h3','h4','h5'
           ])
         })
         it('singleElim N=11 returns first 5 hashes (byeCount=16-11=5)', () => {
           expect(computeByeHashes(hashes(11), 'singleElim')).toEqual([
             'h0','h1','h2','h3','h4'
           ])
         })
       })
       ```

    2. Import `computeByeHashes` at the top of the test file (will fail
       compile — that's the RED).

    3. Clarify the comment in the existing n=10 test (currently line ~167):
       change "byes go to first 6 seeds" to "byes go to first 6 seeds —
       surfaced via computeByeHashes; generateInitialBracket only produces
       round-1 pairs for the non-bye seeds". Assertions stay identical.

    4. Run `pnpm vitest run src/platform/moshpit/services/tournamentBracket.test.ts`
       — expect compile failure (RED).

    5. Commit RED: `test(260423-dum): add failing computeByeHashes tests`

    6. Implement in tournamentBracket.ts:

       ```ts
       export function computeByeHashes(
         hashes: readonly string[],
         shape: BracketShape
       ): readonly string[] {
         const n = hashes.length
         if (n < 2) return []
         if (shape !== 'singleElim') return []
         const byeCount = nextPow2(n) - n
         if (byeCount === 0) return []
         return hashes.slice(0, byeCount)
       }
       ```

    7. Add invariant comment to `generateNextRound` (above the `for` loop):

       ```ts
       // INVARIANT: `winners.length` MUST be even when this function is
       // called. Round 1 is the only place odd counts can surface (due to
       // byes); the store forwards pending byes via computeByeHashes at the
       // round-1 → round-2 boundary so `winners.length` is always a power
       // of 2 here. If this invariant is ever violated, the final winner
       // will be silently dropped — debug by inspecting the caller.
       ```

    8. Run `pnpm vitest run src/platform/moshpit/services/tournamentBracket.test.ts`
       — all green.

    9. Run `pnpm typecheck` — must pass.

    10. Commit GREEN: `feat(260423-dum): export computeByeHashes from tournamentBracket`

  </action>
  <verify>
    <automated>pnpm vitest run src/platform/moshpit/services/tournamentBracket.test.ts</automated>
  </verify>
  <done>
    - `computeByeHashes` exported from `tournamentBracket.ts` with the 7 cases
      above passing.
    - Pure-module invariant test still passes (no new vue / pinia / `@/`
      imports added to `tournamentBracket.ts`).
    - n=10 test comment clarified; assertions unchanged and passing.
    - `generateNextRound` has an invariant comment documenting the
      even-length requirement.
    - `pnpm typecheck` clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Forward byes into round 2 via pendingByeHashes in the store</name>
  <files>
    src/platform/moshpit/stores/moshpitTournamentStore.ts,
    src/platform/moshpit/stores/moshpitTournamentStore.test.ts
  </files>
  <behavior>
    Store gains an internal (non-exposed) `pendingByeHashes: Ref<readonly string[]>`.
    - On `enter(selection)`: `pendingByeHashes.value = computeByeHashes(selection, shape)`.
    - On `pickWinner` round-boundary: if entering the round-1 → round-2
      transition, next-round input = `[...pendingByeHashes.value,
      ...currentRoundWinnersInOrder.value]`. Clear `pendingByeHashes.value = []`
      after consuming. Subsequent round boundaries naturally pass `[]` byes.
    - On `skip` single-elim round-boundary: same prepend pattern.
    - On `resetState()`: `pendingByeHashes.value = []`.
    - `pendingByeHashes` is NOT added to the store's return block — it stays
      internal session state (consistent with `priorSidebarPanelId`,
      `currentRoundWinnersInOrder`, `totalPicksExpected`).

    New end-to-end store tests:
    1. N=9 entry: bracket starts with 1 round-1 pair (N-byeCount = 9-7 = 2
       non-bye seeds paired as (7,8)). After 1 pick, round 2 exists with
       generateNextRound([...7 byes, 1 winner] = 8 hashes) = 4 pairs. Drive
       to completion with pick 'A' every time; `winnerHashes.length === 1`
       and champion === the persistently-picked hash. Final bracket length
       = N - 1 = 8.
    2. N=10 entry: bracket starts with 2 round-1 pairs. After 2 picks,
       round 2 = 4 pairs (6 byes + 2 winners = 8 hashes). After 4 more
       picks, round 3 = 2 pairs. After 2 more picks, round 4 = 1 pair. After
       1 more pick, finished. Final bracket length = 9.
    3. N=11 entry: 3 round-1 pairs; after round 1, 8 participants = 4 round-2
       pairs. Final bracket length = 10.
    4. N=16 regression guard: bracket starts with 8 round-1 pairs; round 2
       has 4; round 3 has 2; round 4 has 1. Final bracket length = 15. No
       behavioural change vs pre-fix.
    5. Bye-champion: N=10 entry ['a','b','c','d','e','f','g','h','i','j'].
       Pick 'A' on every round-1 pair; then the round-2 inputs are
       ['a','b','c','d','e','f', <round1-winners>]. Pick 'A' every subsequent
       round → 'a' (a bye seed in round 1) is the champion.
    6. skip() in round 1 of N=10: seed A of first pair bye-advances (D-03).
       At round-1 boundary, round 2 still forms with
       [...6 byes, <seedA advanced>, <other round-1 winner>] = 8 hashes = 4
       pairs.
    7. Exit + re-enter leak check: enter N=10, skip a few, exit('esc'),
       then enter N=4 (round-robin). `pendingByeHashes` must be empty
       (verified indirectly: round-robin bracket length = 6, no rogue round
       appended). Since `pendingByeHashes` is not exposed, the guard is
       behavioural — the round-robin tournament must not generate any
       round-2 pairs on completion.

  </behavior>
  <action>
    1. Add RED test cases to moshpitTournamentStore.test.ts. Create a new
       describe block `describe('single-elim bye forwarding (260423-dum fix)', ...)`
       with 6 tests (cases 1–6 above) plus one leak-check test (case 7) —
       either in that block or in the existing `describe('TOUR-05 ephemerality')`
       block.

       Example skeleton for case 2 (N=10 full playthrough):

       ```ts
       it('N=10 single-elim: all 10 assets participate; final bracket length = 9', () => {
         const store = useMoshpitTournamentStore()
         const hs = Array.from({ length: 10 }, (_, i) => `h${i}`)
         store.enter(hs)

         expect(store.bracketShape).toBe('singleElim')
         expect(store.bracket.length).toBe(2) // round 1: 2 pairs

         store.pickWinner('A') // pair (h6,h7) → h6
         store.pickWinner('A') // pair (h8,h9) → h8

         // Round 2: 6 byes (h0..h5) + 2 winners (h6,h8) = 8 → 4 pairs
         expect(store.bracket.length).toBe(2 + 4)

         // Drive remaining 7 picks to completion (4 + 2 + 1 = 7 picks)
         let safety = 0
         while (!store.isFinished && safety < 20) {
           store.pickWinner('A')
           safety++
         }
         expect(store.isFinished).toBe(true)
         expect(store.bracket.length).toBe(9) // N-1 total picks
         expect(store.winnerHashes.length).toBe(1)
       })
       ```

    2. Case 5 (bye-champion): after pickWinner('A') every time, champion
       must be 'a' because h0 = 'a' is the first bye seed and byes are
       prepended to round-2 input.

    3. Case 6 (skip-with-byes):

       ```ts
       it('N=10 single-elim: skip in round 1 still forms round 2 correctly', () => {
         const store = useMoshpitTournamentStore()
         const hs = Array.from({ length: 10 }, (_, i) => `h${i}`)
         store.enter(hs)

         // First pair = (h6, h7). Skip bye-advances h6.
         store.skip()
         // Second pair = (h8, h9). Pick A → h8 wins.
         store.pickWinner('A')

         // Round 2: 6 byes + h6 (skip-advanced) + h8 (picked) = 8 → 4 pairs
         expect(store.bracket.length).toBe(2 + 4)
       })
       ```

    4. Case 7 (leak check):

       ```ts
       it('pendingByeHashes does not leak across exit → enter sessions', () => {
         const store = useMoshpitTournamentStore()
         // Session 1: N=10 singleElim (byes exist)
         store.enter(Array.from({ length: 10 }, (_, i) => `h${i}`))
         store.pickWinner('A')
         store.exit('esc')

         // Session 2: N=4 roundRobin (no byes — must not inherit previous)
         store.enter(['a', 'b', 'c', 'd'])
         for (let i = 0; i < 6; i++) store.pickWinner('A')
         expect(store.isFinished).toBe(true)
         expect(store.bracket.length).toBe(6) // round-robin, no rogue round
       })
       ```

    5. Run `pnpm vitest run src/platform/moshpit/stores/moshpitTournamentStore.test.ts`
       — new tests fail (RED), existing `completing single-elim round
       generates next round pairs` (N=8) stays green (power-of-2 path is
       already correct).

    6. Commit RED: `test(260423-dum): add failing single-elim bye-forwarding tests`

    7. Edit moshpitTournamentStore.ts:

       a. Add `computeByeHashes` to the imports from `../services/tournamentBracket`.

       b. Add internal ref near the other session state (around line ~91):

          ```ts
          const pendingByeHashes: Ref<readonly string[]> = ref([])
          ```

       c. In `resetState()` add:

          ```ts
          pendingByeHashes.value = []
          ```

       d. In `enter()` after computing `shape` (around line ~180):

          ```ts
          pendingByeHashes.value = computeByeHashes(selection, shape)
          ```

       e. Extract the round-boundary "maybe generate next round" logic into
          a local helper to DRY the pickWinner + skip branches:

          ```ts
          function maybeGenerateNextRound(): void {
            if (currentPairIndex.value < bracket.value.length) return
            const winnersAndByes = [
              ...pendingByeHashes.value,
              ...currentRoundWinnersInOrder.value
            ]
            if (winnersAndByes.length < 2) return
            const nextRound = generateNextRound(
              winnersAndByes,
              totalPicksExpected.value,
              bracket.value.length
            )
            if (nextRound.length === 0) return
            bracket.value = [...bracket.value, ...nextRound]
            currentRoundWinnersInOrder.value = []
            pendingByeHashes.value = [] // consumed once at round 1 → round 2
          }
          ```

       f. Replace the `if (currentPairIndex.value >= bracket.value.length)`
          blocks in both `pickWinner` (singleElim branch) and `skip`
          (singleElim branch) with a call to `maybeGenerateNextRound()`.
          The `currentPairIndex` / `currentRoundWinnersInOrder` updates
          BEFORE the helper call stay inline as they are now.

       g. Do NOT add `pendingByeHashes` to the return block — keep it
          internal.

    8. Run `pnpm vitest run src/platform/moshpit/stores/moshpitTournamentStore.test.ts`
       — all green.

    9. Run `pnpm vitest run src/platform/moshpit/` to confirm no regression
       elsewhere in moshpit unit tests.

    10. Run `pnpm typecheck` — must pass. `pendingByeHashes` must be typed
        `Ref<readonly string[]>`; the `maybeGenerateNextRound` helper has
        no parameters (pure closure over store refs).

    11. Commit GREEN: `fix(260423-dum): forward single-elim byes into round 2`

  </action>
  <verify>
    <automated>pnpm vitest run src/platform/moshpit/stores/moshpitTournamentStore.test.ts src/platform/moshpit/services/tournamentBracket.test.ts</automated>
  </verify>
  <done>
    - `pendingByeHashes` ref exists in the store, seeded in `enter()`,
      cleared in `resetState()`, consumed + cleared in
      `maybeGenerateNextRound()`.
    - `pickWinner` and `skip` both funnel their round-boundary handling
      through `maybeGenerateNextRound()`.
    - All new N=9 / N=10 / N=11 / skip / bye-champion / leak tests pass.
    - Existing N=8 (power-of-2) test still passes.
    - `pendingByeHashes` is NOT in the store's return block.
    - `pnpm typecheck` clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Bracket tree regression guard + full-project quality gates</name>
  <files>
    src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts
  </files>
  <behavior>
    Add a single Vitest case to `MoshpitTournamentBracketTree.test.ts`
    covering N=10 single-elim. After a full playthrough, the tree must
    render 4 round columns with pair counts `[2, 4, 2, 1]`. This guards
    against a future regression where `singleElimRoundSizes(10)` (already
    `[2,4,2,1]`) drifts out of sync with the store's actual round sequence.
    No production code changes to `MoshpitTournamentBracketTree.vue` — the
    existing `singleElimRoundSizes` helper is already correct for the
    post-fix world.
  </behavior>
  <action>
    1. Add to MoshpitTournamentBracketTree.test.ts inside the existing
       `describe('MoshpitTournamentBracketTree', ...)`:

       ```ts
       it('single-elim N=10: renders 4 round columns with [2,4,2,1] pair counts (bye fix regression guard)', async () => {
         const store = useMoshpitTournamentStore()
         const hs = Array.from({ length: 10 }, (_, i) => `h${i}`)
         store.enter(hs)

         renderTree()
         await nextTick()

         // Initial state: only round 0 is rendered (2 pairs). Round 1+
         // materialise after each round boundary.
         expect(
           within(screen.getByTestId('moshpit-bracket-round-0'))
             .queryAllByTestId(/^moshpit-bracket-pair-/).length
         ).toBe(2)

         // Drive to completion, checking round columns grow as expected.
         let safety = 0
         while (!store.isFinished && safety < 20) {
           store.pickWinner('A')
           safety++
         }
         await nextTick()

         // Tournament is over, so bracket tree self-hides (existing
         // rule: v-if on !isFinished).
         expect(screen.queryByTestId('moshpit-bracket-root')).toBeNull()

         // Re-mount in the pre-final state to assert column counts.
         store.exit('complete')
         store.enter(hs)
         renderTree()
         await nextTick()

         // Consume only round 1 (2 picks) — round 2 materialises.
         store.pickWinner('A')
         store.pickWinner('A')
         await nextTick()

         // Now rounds 0 and 1 exist.
         expect(
           within(screen.getByTestId('moshpit-bracket-round-0'))
             .queryAllByTestId(/^moshpit-bracket-pair-/).length
         ).toBe(2)
         expect(
           within(screen.getByTestId('moshpit-bracket-round-1'))
             .queryAllByTestId(/^moshpit-bracket-pair-/).length
         ).toBe(4)
       })
       ```

       Note: The existing test `'renders nothing when the tournament is
       finished'` already covers the final-state hide behaviour; this new
       test focuses on mid-tournament column sizing. If the
       "renderTree then re-mount" dance is awkward, an alternative is to
       stop at mid-tournament only (no full playthrough), which is simpler
       and still asserts the bye-fix outcome. Use whichever is cleaner.

    2. Run `pnpm vitest run src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts`
       — new test green; existing tests still pass.

    3. Quality gates on touched files (broader checks):
       - `pnpm typecheck` — full-project must pass.
       - `pnpm lint --quiet` on the touched files (pass paths via
         `eslint --config eslint.config.ts <paths>` if `pnpm lint` runs the
         whole repo and is slow; otherwise just run `pnpm lint`).
       - `pnpm vitest run src/platform/moshpit` — full moshpit unit test
         surface green (≥625 tests per STATE.md).

    4. Run `pnpm format` on the touched files.

    5. Commit: `test(260423-dum): regression guard for bracket tree column counts at N=10`

  </action>
  <verify>
    <automated>pnpm vitest run src/platform/moshpit && pnpm typecheck</automated>
  </verify>
  <done>
    - New N=10 column-count test passes.
    - All moshpit unit tests green (full `pnpm vitest run src/platform/moshpit`).
    - `pnpm typecheck` clean.
    - `pnpm lint` clean on touched files.
    - Formatter run over touched files (no diff noise on subsequent runs).
  </done>
</task>

</tasks>

<verification>
Post-execution phase checks:
- `pnpm vitest run src/platform/moshpit/services/tournamentBracket.test.ts` — green, new `computeByeHashes` describe block included.
- `pnpm vitest run src/platform/moshpit/stores/moshpitTournamentStore.test.ts` — green, new N=9/10/11/16/skip/bye-champion/leak tests included.
- `pnpm vitest run src/platform/moshpit/components/MoshpitTournamentBracketTree.test.ts` — green, new N=10 column-count test included.
- `pnpm typecheck` clean.
- `pnpm lint` clean (on at minimum the 5 touched files).
- Pure-module invariant test still passes (no new vue/pinia/`@/` imports in tournamentBracket.ts).
- Manual smoke (optional, not gating): `pnpm dev`, open Moshpit, select 10 assets, enter tournament, confirm bracket shows 9 total pairs across 4 rounds and all 10 assets appear in bracket seed labels.
</verification>

<success_criteria>

- For N ∈ {9, 10, 11}, every entered asset participates in the bracket; final
  bracket length = N − 1.
- For N = 16 (and every power of 2 ≥ 8), bracket behaviour is byte-identical
  to pre-fix (regression guard).
- A bye seed can win the tournament end-to-end.
- `skip()` in round 1 of a byed bracket still produces a correctly-sized
  round 2.
- Pure module `tournamentBracket.ts` still passes the worker-safe import
  invariant test.
- All moshpit unit tests green; `pnpm typecheck` and `pnpm lint` clean on
  touched files.
  </success_criteria>

<output>
After completion, do NOT create a SUMMARY.md — this is a `/gsd-quick` flow
and will be wrapped up via the quick-task commit discipline (commit per
task) under directory
`.planning/quick/260423-dum-fix-single-elim-bye-handling-in-tourname/`.
</output>
