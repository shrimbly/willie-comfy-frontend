---
phase: 02-asset-pipeline
plan: 03
type: execute
wave: 1
depends_on: ['02-01', '02-02']
files_modified:
  - src/platform/moshpit/services/layoutMath.ts
autonomous: true
requirements: [ASSET-09]
tags: [pure-functions, layout, jittered-grid, wave-1, tdd]
must_haves:
  truths:
    - "`computeSquareGridDimensions(n)` returns `{ cols, rows }` where cols = rows = ceil(sqrt(n)) when n fits a square, else cols is the ceil and rows = ceil(n / cols), matching D-03 'square scaled to ceil(sqrt(N)) cells per side'"
    - '`computeJitteredGrid(hashes, seed, cellSize)` returns `GridSlot[]` with jitter strictly less than cellSize/2 per D-01'
    - 'Same (hashes, seed, cellSize) → identical GridSlot[] — deterministic for muscle-memory spatial recognition (D-02)'
    - 'Empty input returns empty array (no divide-by-zero; no crash on n=0)'
    - 'All Wave-0 tests in `layoutMath.test.ts` turn GREEN'
  artifacts:
    - path: 'src/platform/moshpit/services/layoutMath.ts'
      provides: 'Pure layout functions: computeSquareGridDimensions, computeJitteredGrid, computePackedGrid, GridSlot type'
      contains: 'export function computeJitteredGrid'
  key_links:
    - from: 'src/platform/moshpit/services/layoutMath.ts'
      to: 'src/platform/moshpit/services/contentHash.ts'
      via: 'import { mulberry32 }'
      pattern: "import \\{ mulberry32 \\}"
---

<objective>
Implement the jittered-grid layout math (D-01, D-02, D-03, D-04) as a pure-function module. Turn the three `layoutMath.test.ts` cases GREEN. Produce the `computePackedGrid` function that Plan 10 will use for the re-pack tween.

Purpose: Decouple layout math from the canvas / Pinia / Pixi so it is trivially unit-testable. The math is the substrate for Phase 3's sort (which will replace jittered assignment with parameter-axis assignment while keeping the same coordinate system).

Output: One ~70-line pure module, zero runtime dependencies beyond `./contentHash`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-asset-pipeline/02-CONTEXT.md
@.planning/phases/02-asset-pipeline/02-RESEARCH.md
@src/platform/moshpit/services/contentHash.ts

<interfaces>
Public API of `src/platform/moshpit/services/layoutMath.ts`:

```typescript
export interface GridSlot {
  readonly hash: string
  readonly worldX: number
  readonly worldY: number
}

export interface GridDimensions {
  readonly cols: number
  readonly rows: number
}

/** D-03: square bounding region scaled to ceil(sqrt(N)) cells per side. */
export function computeSquareGridDimensions(n: number): GridDimensions

/** D-01/D-02: jittered chaos layout seeded by `seed`. Deterministic. */
export function computeJitteredGrid(
  hashes: readonly string[],
  seed: number,
  cellSize: number
): GridSlot[]

/** D-04: packed grid (no jitter) — target positions for the re-pack tween. */
export function computePackedGrid(
  hashes: readonly string[],
  cellSize: number
): GridSlot[]
```

Imports from `./contentHash`:

```typescript
import { mulberry32 } from './contentHash'
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement layoutMath.ts — square grid dimensions, jittered grid, packed grid</name>
  <read_first>
    - src/platform/moshpit/services/layoutMath.test.ts (RED tests from Plan 01 — make GREEN)
    - src/platform/moshpit/services/contentHash.ts (for `mulberry32` import signature)
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §Layout Seed Hash + Jittered Grid Math (reference impl)
    - .planning/phases/02-asset-pipeline/02-CONTEXT.md decisions D-01, D-02, D-03, D-04 (locked; implement exactly)
  </read_first>
  <behavior>
    - computeSquareGridDimensions(0) === { cols: 0, rows: 0 } (no divide-by-zero)
    - computeSquareGridDimensions(1) === { cols: 1, rows: 1 }
    - computeSquareGridDimensions(10) === { cols: 4, rows: 3 } — ceil(sqrt(10))=4 cols, ceil(10/4)=3 rows
    - computeSquareGridDimensions(16) === { cols: 4, rows: 4 }
    - computeSquareGridDimensions(17) === { cols: 5, rows: 4 }
    - computeJitteredGrid([], 42, 560) === [] (empty input)
    - computeJitteredGrid(hashes, 42, 560) length === hashes.length
    - Jitter is bounded by |worldX - col*cellSize| < cellSize/2 for every slot (D-01)
    - Same (hashes, seed, cellSize) → same output (D-02 determinism)
    - computePackedGrid puts slot i at (i % cols * cellSize, floor(i / cols) * cellSize) — NO jitter
  </behavior>
  <action>
Create `src/platform/moshpit/services/layoutMath.ts`:

```typescript
/**
 * Pure layout math for the Moshpit jittered-grid chaos placement (D-01..D-04).
 *
 * Coordinate system: world-space pixels (matches pixi-viewport's worldWidth/
 * worldHeight). The `MoshpitCanvas.vue` sprite container sits inside the
 * `Viewport`, so world coords pan/zoom with the viewport.
 *
 * Jitter bound: strictly less than cellSize/2 so two adjacent slots never
 * overlap geometrically (D-01).
 *
 * Determinism: same (hashes, seed, cellSize) always produces the same slots.
 * This drives the filter-hash-seeded layout story (D-02): re-entering the same
 * filter snaps the user back into the same spatial arrangement so muscle
 * memory works.
 */

import { mulberry32 } from './contentHash'

export interface GridSlot {
  readonly hash: string
  readonly worldX: number
  readonly worldY: number
}

export interface GridDimensions {
  readonly cols: number
  readonly rows: number
}

/**
 * D-03: square bounding region with `ceil(sqrt(N))` cells per side.
 * For non-square counts, `rows` is the minimum number needed to hold N items
 * given `cols` columns.
 */
export function computeSquareGridDimensions(n: number): GridDimensions {
  if (n <= 0) return { cols: 0, rows: 0 }
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  return { cols, rows }
}

/**
 * D-01 / D-02: Deterministic jittered grid. Each slot is assigned to its
 * positional cell (row-major by input order — the caller is responsible for
 * sorting the input for D-02 determinism across reloads); jitter is sampled
 * from `mulberry32(seed)` and scaled to strictly less than cellSize/2.
 */
export function computeJitteredGrid(
  hashes: readonly string[],
  seed: number,
  cellSize: number
): GridSlot[] {
  if (hashes.length === 0) return []
  const { cols } = computeSquareGridDimensions(hashes.length)
  const rng = mulberry32(seed)
  // Jitter is bounded STRICTLY BELOW cellSize/2. Using 0.49 keeps us safely
  // inside the bound even after float rounding.
  const maxJitter = cellSize * 0.49

  const slots: GridSlot[] = new Array(hashes.length)
  for (let i = 0; i < hashes.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const jitterX = (rng() - 0.5) * 2 * maxJitter
    const jitterY = (rng() - 0.5) * 2 * maxJitter
    slots[i] = {
      hash: hashes[i],
      worldX: col * cellSize + jitterX,
      worldY: row * cellSize + jitterY
    }
  }
  return slots
}

/**
 * D-04: Packed grid — identical cell assignment as the jittered grid but with
 * zero jitter. Targets the re-pack tween after metadata-excluded assets have
 * dropped out and the surviving set is re-laid.
 */
export function computePackedGrid(
  hashes: readonly string[],
  cellSize: number
): GridSlot[] {
  if (hashes.length === 0) return []
  const { cols } = computeSquareGridDimensions(hashes.length)
  const slots: GridSlot[] = new Array(hashes.length)
  for (let i = 0; i < hashes.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    slots[i] = {
      hash: hashes[i],
      worldX: col * cellSize,
      worldY: row * cellSize
    }
  }
  return slots
}
```

Notes:

- `readonly` on the interface fields prevents accidental mutation in downstream code.
- `0.49` instead of `0.5` because strict inequality plus float rounding could otherwise produce `0.5 * cellSize` exactly. The test uses `<` so this matters.
- DO NOT add a public `layoutSeedHash` re-export here. Callers import it directly from `contentHash.ts`.
- NO `any`, NO `as any`.
  </action>
  <verify>
  <automated>pnpm test:unit --run src/platform/moshpit/services/layoutMath.test.ts</automated>
  </verify>
  <acceptance_criteria> - `test -f src/platform/moshpit/services/layoutMath.ts` exits 0 - `grep -c "^export function" src/platform/moshpit/services/layoutMath.ts` returns 3 - `grep "^export interface GridSlot" src/platform/moshpit/services/layoutMath.ts` returns one match - `grep "import { mulberry32 } from './contentHash'" src/platform/moshpit/services/layoutMath.ts` returns one match - `pnpm test:unit --run src/platform/moshpit/services/layoutMath.test.ts` exits 0 with 3 tests passing - `pnpm typecheck` exits 0 - File does NOT import from `vue`, `pinia`, `@/stores`, or `pixi.js`
  </acceptance_criteria>
  <done>Three pure layout functions; Wave-0 layoutMath tests GREEN.</done>
  </task>

</tasks>

<threat_model>

## Trust Boundaries

None — this module is a pure-function leaf with no I/O, no network calls, and no user input surface.

## STRIDE Threat Register

| Threat ID  | Category          | Component                                                   | Disposition | Mitigation Plan                                                                                                                                                                                               |
| ---------- | ----------------- | ----------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-02-03-01 | Denial of Service | `computeJitteredGrid` at 5k assets                          | accept      | O(N) single pass, ~100k float ops worst case at 5k. Runs in <2ms. Bounded by 5k PROJECT.md budget.                                                                                                            |
| T-02-03-02 | Tampering         | Seed collision producing visually indistinguishable layouts | accept      | FNV-1a 32-bit collision space is 2^32; probability of collision within a user session is negligible. Failure mode is benign: two different filters produce the same chaos — users get the same muscle-memory. |

</threat_model>

<verification>
- `pnpm test:unit --run src/platform/moshpit/services/layoutMath.test.ts` — 3 tests PASS
- `pnpm typecheck` exits 0
- `pnpm lint` on the new file exits 0
</verification>

<success_criteria>

- Three pure functions plus two interfaces exported
- Determinism + bounded-jitter tests GREEN
- Zero intra-repo imports other than `./contentHash`
  </success_criteria>

<output>
Create `.planning/phases/02-asset-pipeline/02-03-SUMMARY.md` noting the jitter constant choice (0.49 vs 0.5) and confirming the three utilities are reachable via Plan 10's re-pack tween.
</output>
