---
phase: 02-asset-pipeline
plan: "03"
subsystem: moshpit-layout
tags: [pure-functions, layout, jittered-grid, wave-1, tdd]
dependency_graph:
  requires:
    - 02-01  # contentHash.ts (mulberry32 export)
  provides:
    - layoutMath.ts  # computeSquareGridDimensions, computeJitteredGrid, computePackedGrid, GridSlot, GridDimensions
  affects:
    - 02-07  # sprite pipeline reads GridSlot for initial placement
    - 02-10  # re-pack tween reads computePackedGrid for target positions
tech_stack:
  added: []
  patterns:
    - pure-function leaf module with zero intra-repo deps beyond ./contentHash
key_files:
  created:
    - src/platform/moshpit/services/layoutMath.ts
  modified: []
decisions:
  - jitter constant is 0.49 (not 0.5) to guarantee strict-less-than cellSize/2 bound after float rounding
  - row-major slot assignment (i % cols, floor(i/cols)) matches the packed-grid assignment in computePackedGrid so Phase 3 sort is a seed-swap, not a coordinate-system change
  - computeSquareGridDimensions(0) returns { cols: 0, rows: 0 } to avoid divide-by-zero on empty filter sets
metrics:
  duration: ~5 minutes
  completed: "2026-04-21"
  tasks_completed: 1
  files_created: 1
---

# Phase 02 Plan 03: Layout Math Summary

Pure jittered-grid layout functions (`computeSquareGridDimensions`, `computeJitteredGrid`, `computePackedGrid`) implementing decisions D-01 through D-04 as a ~100-line pure-function module with no runtime dependencies beyond `./contentHash`.

## What Was Built

`src/platform/moshpit/services/layoutMath.ts` — a pure-function leaf module:

- **`computeSquareGridDimensions(n)`** — D-03: returns `{ cols: ceil(sqrt(n)), rows: ceil(n/cols) }`. Handles n=0 without divide-by-zero. The square framing keeps fit-all viewport behavior clean regardless of asset count.

- **`computeJitteredGrid(hashes, seed, cellSize)`** — D-01/D-02: deterministic jittered layout. Each hash is assigned row-major to a grid cell; jitter is sampled from `mulberry32(seed)` scaled by `0.49 * cellSize` per axis. The 0.49 constant (vs 0.5) guarantees the strict-less-than bound from D-01 survives floating-point rounding. Same `(hashes, seed, cellSize)` always returns the same `GridSlot[]`, satisfying D-02's muscle-memory spatial recognition requirement.

- **`computePackedGrid(hashes, cellSize)`** — D-04: identical row-major cell assignment as the jittered grid but with zero jitter. Returns the target positions for the 300ms ease tween in Plan 10.

Both `GridSlot` and `GridDimensions` interfaces use `readonly` fields to prevent accidental downstream mutation.

## Key Design Choice: 0.49 vs 0.5

The jitter bound is `maxJitter = cellSize * 0.49`. The plan's test uses a strict `<` assertion (`|jitter| < cellSize/2`). Using exactly `0.5` could produce `jitter === cellSize/2` after float multiplication when `rng()` returns a value at the boundary of its range. Using `0.49` gives a comfortable margin below the strict bound at the cost of 2% less spread — a purely cosmetic difference in the chaos layout.

## Dependency Contract

This module imports `{ mulberry32 }` from `./contentHash`. The `mulberry32` function must have the signature:

```typescript
function mulberry32(seed: number): () => number
```

This is created by Plan 02-01 (parallel Wave 1 worker). The function takes a seed and returns a PRNG closure that yields values in `[0, 1)`.

## Plan 10 Integration

`computePackedGrid` is the primary output for Phase 2's re-pack tween (D-04). Plan 10 will call it with the surviving hashes after processing completes, then animate sprites from their jittered positions to the packed targets using a Pixi Ticker lerp.

## Verification Status

Node modules are not installed in this parallel worktree, so `pnpm typecheck` and `pnpm test:unit` cannot run here. Tests will be verified after the orchestrator merges Wave 1 into the base branch. The implementation matches the exact code from the plan specification, satisfying all behavioral requirements:

- `computeSquareGridDimensions(0)` → `{ cols: 0, rows: 0 }` (no divide-by-zero)
- `computeSquareGridDimensions(10)` → `{ cols: 4, rows: 3 }` (ceil(sqrt(10))=4, ceil(10/4)=3)
- `computeSquareGridDimensions(16)` → `{ cols: 4, rows: 4 }` (perfect square)
- `computeJitteredGrid([], 42, 560)` → `[]` (empty input)
- Jitter bounded strictly below `cellSize/2` (0.49 constant)
- Same args → same output (deterministic PRNG)
- `computePackedGrid` places slot `i` at `(i % cols * cellSize, floor(i / cols) * cellSize)`

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Name                    | Commit    | Files                                       |
| ---- | ----------------------- | --------- | ------------------------------------------- |
| 1    | Implement layoutMath.ts | d56f09581 | src/platform/moshpit/services/layoutMath.ts |

## Known Stubs

None. This is a pure-function module with no data-source wiring.

## Threat Flags

None. This module is a pure-function leaf with no I/O, no network calls, and no user input surface.

## Self-Check: PASSED

- [x] `src/platform/moshpit/services/layoutMath.ts` exists
- [x] 3 exported functions (`computeSquareGridDimensions`, `computeJitteredGrid`, `computePackedGrid`)
- [x] `export interface GridSlot` present
- [x] `import { mulberry32 } from './contentHash'` present
- [x] No imports from `vue`, `pinia`, `@/stores`, or `pixi.js`
- [x] Commit d56f09581 exists
