---
phase: 04-lineage-groupings-within-cluster-sort
plan: 01
subsystem: moshpit
tags: [clustering, pure-math, worker-safe, fast-check, vitest, grouping, lineage]

requires:
  - phase: 03-filter-sort-core-validation
    provides: NormalizedParams shape, sortMath primitives, filterMath patterns, pure-math + colocated-vitest convention
provides:
  - GROUPING_AXES / GroupingAxis / WITHIN_CLUSTER_SORT_MODES / OTHER_BUCKET_KEY constants
  - normalisePromptKey / deriveTypeBucket / bucketKey axis-extraction primitives (D-07 / D-08 / D-09 / D-10)
  - compareAssetsForWithinCluster global within-cluster comparator (CSORT-01)
  - ClusterNode / ClusterLayoutResult types (D-17)
  - computeNestingOrder — auto-nesting by avg bucket size descending (D-02)
  - computeClusterLayout — recursive row-wrapping packer with depth-proportional gap (D-01 / D-03 / D-04)
  - Memoised bucket-key cache (Pitfall 6) keeping 5k × 5-axis recount inside the 100ms math budget (D-05)
  - Vitest + fast-check coverage: 38 groupAxes tests, 13 clusterLayout tests, 5 k × 3-axis perf marker
affects: [04-02 paramNormalize saveNodeIdentity, 04-03 useMoshpitFilteredAssets refactor, 04-04 moshpitFilterStore, 04-05 cluster overlay, 04-06 grouping toggle UI]

tech-stack:
  added: []
  patterns:
    - Worker-safe pure modules + colocated Vitest (Phase 2/3 convention extended)
    - fast-check property assertions for sort determinism and hash-uniqueness invariants
    - Local Map<string, string> memoisation keyed by "axis|hash" for O(N × axes) bucket-key recompute
    - Forward-compatible structural widening for incremental schema evolution (`NormalizedParams & { saveNodeIdentity?: string | null }`) so Plan 01 ships before Plan 02 extends the schema

key-files:
  created:
    - src/platform/moshpit/services/groupAxes.ts
    - src/platform/moshpit/services/groupAxes.test.ts
    - src/platform/moshpit/services/clusterLayout.ts
    - src/platform/moshpit/services/clusterLayout.test.ts
  modified:
    - src/platform/moshpit/services/sortMath.ts (header comment only — D-16 Phase 4 reuse note)

key-decisions:
  - "Row-wrapping row-major child packing at every depth; `columns = ceil(sqrt(childCount))` at branch levels mirrors the flat-grid leaf packer and keeps the layout deterministic and cheap"
  - "Child bounds are computed at local origin then translated by `(colX[col], rowY[row])` during parent packing; simpler than threading offsets through recursion and easier to test"
  - "Row heights / column widths set to the max child dimension per row / column — handles heterogeneous child sizes without special-casing"
  - "Root node uses depth = -1 sentinel so D-03 gap math (`maxDepth - currentDepth + 1`) lines up naturally"
  - "Memoisation keyed by `${axis}|${hash}` lives inside computeClusterLayout per call; no module-level cache (would break referential transparency at the edge of a Pinia reactive update)"
  - "saveNodeIdentity reads via a narrow structural widening on NormalizedParams — lets Plan 01 ship the grouping substrate before Plan 02 bakes the field into NormalizedParamsSchema and the thumb worker"

patterns-established:
  - "Recursive packer: hash-uniqueness invariant is an explicit fast-check property (Pitfall 2) — every packer change in Phase 4+ carries the same property assertion"
  - "Perf marker as regression guard: `performance.now()` + `toBeLessThan(100)` at 5k hashes × 3 axes; will run on every CI unit suite"
  - "Axis extraction lives in groupAxes.ts (pure), cluster math in clusterLayout.ts (pure). UI / store layers call into both with no reverse dependency"

requirements-completed:
  - GROUP-02
  - GROUP-03
  - GROUP-05
  - GROUP-06
  - GROUP-07
  - GROUP-08
  - GROUP-10
  - CSORT-01

duration: 10min
completed: 2026-04-21
---

# Phase 04 Plan 01: Cluster Math Substrate Summary

**Pure grouping-axis extraction + recursive row-wrapping cluster packer with auto-nesting and <100ms 5k-asset perf budget — the deterministic math substrate Plan 03 wires into `useMoshpitFilteredAssets`.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-21T10:17:00Z
- **Completed:** 2026-04-21T10:26:52Z
- **Tasks:** 2
- **Files created:** 4 (`groupAxes.ts`, `groupAxes.test.ts`, `clusterLayout.ts`, `clusterLayout.test.ts`)
- **Files modified:** 1 (`sortMath.ts` header comment only)

## Accomplishments

- **`groupAxes.ts`** — 5 axes + within-cluster comparator as pure, worker-safe TS. 38 Vitest assertions including a fast-check determinism property for `compareAssetsForWithinCluster`.
- **`clusterLayout.ts`** — recursive packer with auto-nesting, depth-proportional gaps, row-wrapping child packing, `(other)` bucket as a first-class sibling. 13 Vitest assertions including a fast-check hash-uniqueness invariant and a 5k × 3-axis perf marker.
- **`sortMath.ts`** — header comment flags Phase 4 reuse intent (D-16). Zero behavioural changes; all 33 existing `sortMath.test.ts` assertions still green.
- **Perf marker: 18ms measured locally** for 5 000 hashes × 3 axes × 5 buckets per axis, well inside the 100ms budget (D-05) and far below the 400ms end-to-end target (GROUP-10).

## Task Commits

1. **Task 1 RED — failing tests for groupAxes** — `fd5e8117a` (test)
2. **Task 1 GREEN — groupAxes implementation** — `536852e13` (feat)
3. **Task 2 — clusterLayout packer + sortMath header + tests** — `80dcf0142` (feat)

_Note: TDD red → green for Task 1 (separate commits). Task 2 combined RED and GREEN into the single feat commit because the test file is part of the same logical unit and the RED was confirmed independently before the GREEN was written._

## Final Exported Signatures

### `clusterLayout.ts`

```ts
export function computeNestingOrder(
  visibleHashes: readonly string[],
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  filenameByHash: ReadonlyMap<string, string | null>,
  activeAxes: readonly GroupingAxis[]
): readonly GroupingAxis[]

export function computeClusterLayout(
  visibleHashes: readonly string[],
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  filenameByHash: ReadonlyMap<string, string | null>,
  activeGroupingsInOrder: readonly GroupingAxis[],
  withinClusterSort: WithinClusterSortMode,
  gridSpacing: number
): ClusterLayoutResult

export interface ClusterNode {
  readonly axis: GroupingAxis | null
  readonly bucketValue: string
  readonly depth: number
  readonly boundsWorld: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly children: readonly ClusterNode[]
  readonly leafHashes: readonly string[]
}

export interface ClusterLayoutResult {
  readonly root: ClusterNode
  readonly slots: readonly GridSlot[]
}
```

### `groupAxes.ts`

```ts
export const GROUPING_AXES = ['workflow', 'saveNode', 'prompt', 'model', 'type'] as const
export type GroupingAxis = (typeof GROUPING_AXES)[number]
export type WithinClusterSortMode = 'newestFirst' | 'oldestFirst' | 'alphabetical'
export const WITHIN_CLUSTER_SORT_MODES: readonly WithinClusterSortMode[]
export const OTHER_BUCKET_KEY: string

export function normalisePromptKey(prompt: string | undefined): string
export function deriveTypeBucket(
  params: Pick<NormalizedParams, 'width' | 'height'>
): 'landscape' | 'portrait' | 'square' | '(other)'
export function bucketKey(
  axis: GroupingAxis,
  params: NormalizedParams,
  _filenameOfAsset: string | null
): string
export function compareAssetsForWithinCluster(
  a: { readonly contentHash: string; readonly params: NormalizedParams; readonly filename: string | null },
  b: { readonly contentHash: string; readonly params: NormalizedParams; readonly filename: string | null },
  mode: WithinClusterSortMode
): number
```

## Perf Marker Evidence

From `pnpm test:unit -- src/platform/moshpit/services/clusterLayout.test.ts --run --reporter=verbose`:

```
✓ computeClusterLayout — perf budget (GROUP-10 / D-05) > completes a 5000-hash x 3-axis layout in under 100ms  18ms
```

18 ms against a 100 ms budget. The test fixture generates `hash-0..hash-4999` with five distinct `workflowFilename`, `model`, and `positivePrompt` buckets each, producing ~5³ = 125 leaf clusters of ~40 assets each — well in the plan's intended envelope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected D-09 boundary example in test fixture**

- **Found during:** Task 1 (groupAxes.test.ts authoring)
- **Issue:** The plan's `<behavior>` bullet asserts `deriveTypeBucket({ width: 1024, height: 888 }) === 'square'` with the note "ratio ≈ 1.153 — NOT greater than 1.15". The arithmetic is wrong: 1024/888 = 1.15315… which IS greater than 1.15. The plan's algorithm code (unchanged) returns `landscape` for this input.
- **Fix:** The test fixture asserts `landscape` for `{ width: 1024, height: 888 }`, matching the documented algorithm (`if (ratio > 1.15) return 'landscape'`). The algorithm is correct; only the plan's commentary was mathematically off.
- **Files modified:** `src/platform/moshpit/services/groupAxes.test.ts`
- **Verification:** All 38 `groupAxes.test.ts` assertions green.
- **Committed in:** `fd5e8117a` (Task 1 RED), `536852e13` (Task 1 GREEN)

**2. [Rule 3 - Blocking] Swapped inline `type` specifiers to top-level `import type` statements**

- **Found during:** Task 2 post-implementation lint
- **Issue:** `.oxlintrc.json`'s `import/consistent-type-specifier-style: prefer-top-level` rejects mixed-mode imports like `import { GROUPING_AXES, type GroupingAxis } from './groupAxes'`.
- **Fix:** Split runtime vs type imports into separate statements in `clusterLayout.ts` and `clusterLayout.test.ts`.
- **Files modified:** `src/platform/moshpit/services/clusterLayout.ts`, `src/platform/moshpit/services/clusterLayout.test.ts`
- **Verification:** `pnpm exec oxlint <5 files>` returns 0 warnings / 0 errors.
- **Committed in:** `80dcf0142` (Task 2 commit — applied before the final stage).

---

**Total deviations:** 2 auto-fixed (1 plan-doc bug, 1 style/lint blocking).
**Impact on plan:** Both fixes essential for green verification. No scope creep.

## Issues Encountered

- **Pre-existing `pnpm typecheck` errors** in `src/platform/moshpit/services/thumbRepository.ts` and `src/renderer/extensions/minimap/composables/useMinimap.test.ts` block the husky pre-commit typecheck step. These errors exist on `moshpit` branch HEAD before Plan 04-01 started (verified via checkout of the pre-plan tree). The commits still land — git accepts them, only lint-staged's staging revert is triggered. The `thumbRepository` errors will be addressed in Plan 04-02 (D-11 IDB v3 migration); the minimap error is unrelated and filed in `deferred-items.md` for follow-up.

## Forward Compatibility with Plan 02 (`saveNodeIdentity`)

`groupAxes.ts` reads `saveNodeIdentity` via the structural type `NormalizedParams & { saveNodeIdentity?: string | null }` so it compiles cleanly today (where `NormalizedParamsSchema` does not include the field) and continues to compile once Plan 02 extends the schema. At runtime the field is read as `params.saveNodeIdentity ?? OTHER_BUCKET_KEY`:

- Pre-Plan-02: the field is always `undefined` → every asset lands in `(other)` when the `saveNode` axis is active, a correct and non-breaking default until Plan 02 populates the field.
- Post-Plan-02: once `normalizeParams` sets `saveNodeIdentity` to the save-node title / class (D-08), the existing code path produces meaningful groupings with zero edits.

This matches the Phase 3 extension pattern (`workflowFilename` was added the same way) and keeps Plan 01 / Plan 02 independently shippable.

## Next Plan Readiness

- `computeClusterLayout` returns `{ root, slots }` where `slots` is the exact `readonly GridSlot[]` shape `useMoshpitSpriteLayer` already consumes — Plan 03 can swap the layout call over with no sprite-layer edits.
- `computeNestingOrder` separates "decide which axis nests outermost" from "pack the tree", so the Pinia store can memoise the order alongside `activeGroupings` without touching the packer.
- The `ClusterNode` tree exposes `boundsWorld` + `children` — enough for Plan 05's HTML overlay to walk the top two levels for label rendering.

## Self-Check: PASSED

- `src/platform/moshpit/services/groupAxes.ts` — FOUND
- `src/platform/moshpit/services/groupAxes.test.ts` — FOUND
- `src/platform/moshpit/services/clusterLayout.ts` — FOUND
- `src/platform/moshpit/services/clusterLayout.test.ts` — FOUND
- `src/platform/moshpit/services/sortMath.ts` header comment — FOUND (1 match for "Phase 4 reuse note")
- Commit `fd5e8117a` (test RED) — FOUND in git log
- Commit `536852e13` (feat groupAxes) — FOUND in git log
- Commit `80dcf0142` (feat clusterLayout) — FOUND in git log
- All 84 tests across `groupAxes.test.ts`, `clusterLayout.test.ts`, `sortMath.test.ts` — GREEN
- `pnpm exec oxlint` on the 5 affected files — 0 warnings / 0 errors
- No `vue` / `pinia` / `@/*` imports in either new module — verified via grep

---
*Phase: 04-lineage-groupings-within-cluster-sort*
*Completed: 2026-04-21*
