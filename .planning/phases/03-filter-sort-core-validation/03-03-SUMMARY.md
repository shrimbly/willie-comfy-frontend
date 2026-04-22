---
phase: 03-filter-sort-core-validation
plan: '03'
subsystem: moshpit-sort-math
tags: [moshpit, sort, layout, pure-math, grid-snap, tdd]
dependency_graph:
  requires:
    - '03-02: filterTypes.ts (ParamKey)'
    - '03-01: paramNormalize.ts (NormalizedParams)'
    - '02-xx: layoutMath.ts (GridSlot)'
  provides:
    - 'sortMath.ts: computeSortedLayout1D, computeSortedLayout2D'
    - 'SortedGridSlot, ColumnDescriptor, RowDescriptor types'
    - 'SORTABLE_PARAM_KEYS canonical list for sort UI'
  affects:
    - '03-06: useMoshpitFilteredAssets (consumes computeSortedLayout1D/2D)'
    - '03-08: MoshpitAxisOverlay (consumes ColumnDescriptor[], RowDescriptor[])'
tech_stack:
  added: []
  patterns:
    - 'TDD red-green cycle (failing test → implementation)'
    - 'Row-band accumulation for 2D same-cell stacking'
    - 'Column-per-unique-value bucketing (D-16)'
    - 'Numeric vs categorical sort ordering in compareGroupKeys'
key_files:
  created:
    - src/platform/moshpit/services/sortMath.ts
    - src/platform/moshpit/services/sortMath.test.ts
  modified: []
decisions:
  - 'Row-band accumulation chosen for 2D stacking to guarantee SORT-05 literal (no sub-cell offsets)'
  - 'extractSortValue uses switch on ParamKey with non-finite number guard (threat T-03-03-02)'
  - 'loras sort by count (length) — count is always defined so 0-LoRA assets are NOT excluded'
  - 'compareGroupKeys: numeric sort if both keys parse as Number.isFinite, else alphabetic'
  - 'workflowFilename + workflowFingerprint shape sourced from actual paramNormalize.ts (Zod-inferred)'
metrics:
  duration: '~10 minutes'
  completed: '2026-04-20'
  tasks_completed: 2
  files_changed: 2
---

# Phase 03 Plan 03: sortMath — Pure Sort Layout Math Summary

**One-liner:** Pure 1D and 2D sort layout math using column-per-unique-value bucketing with row-band accumulation, every worldX/worldY an exact integer multiple of gridSpacing (SORT-01..05).

## What Was Built

### `src/platform/moshpit/services/sortMath.ts`

Implements the complete sort layout engine for the Moshpit canvas:

- **`computeSortedLayout1D`** — groups visible asset hashes by their serialized `sortX` parameter value into one column per unique value (D-16). Numeric values sort numerically; categorical values sort alphabetically. Assets lacking the sorted parameter are excluded (SORT-03). All `worldX = columnIndex * gridSpacing` and `worldY = rowIndex * gridSpacing` — exact integer multiples per SORT-05.

- **`computeSortedLayout2D`** — same bucketing on both axes. Uses **row-band accumulation** for same-cell stacking: `yStackSize[r]` = max asset count in any cell of row `r`; `rowStart[r] = gridSpacing × sum(yStackSize[0..r-1])`. Asset `k` in cell `(r, c)` lands at `worldY = rowStart[r] + k × gridSpacing`. This guarantees every worldY is an exact integer multiple of gridSpacing with no overlap between rows even when cells stack multiple assets.

- **`SORTABLE_PARAM_KEYS`** — canonical list of 10 sortable parameter keys: `model`, `loras`, `cfg`, `steps`, `sampler`, `scheduler`, `seed`, `width`, `height`, `timestamp`. Used by sort UI to populate the axis picker.

- **`isSortableParamKey`** — type-safe predicate to test whether a `ParamKey` is in the sortable set.

### Output Shapes for Downstream Consumers

```typescript
// Every slot — worldX and worldY are exact multiples of gridSpacing
interface SortedGridSlot extends GridSlot {
  readonly columnIndex: number // 0-based
  readonly rowIndex: number // 0-based within the column (1D) or cell (2D)
}

// One per unique sortX value — for axis-label overlay
interface ColumnDescriptor {
  readonly paramValue: string // serialized value label (e.g. "7", "euler_a")
  readonly columnIndex: number
  readonly worldX: number // = columnIndex * gridSpacing
}

// One per unique sortY value — for 2D axis-label overlay
interface RowDescriptor {
  readonly paramValue: string
  readonly rowIndex: number
  readonly worldY: number // = rowStart[rowIndex] — NOT naïve rowIndex * gridSpacing!
}
```

**Critical note for axis-overlay (Plan 03-08):** `rows[r].worldY` reflects the accumulated row-band offset, not a naïve `r × gridSpacing`. When row 0 has 3 stacked assets, `rows[1].worldY = 3 × gridSpacing`, not `1 × gridSpacing`. Axis labels must use `rows[r].worldY` directly.

### `src/platform/moshpit/services/sortMath.test.ts`

33 tests across 17 describe blocks covering:

- SORT-01: Column bucketing, numeric ordering, categorical ordering, vertical stacking
- SORT-02: 2D scatter layout, row-band accumulation test cases A, B, C
- SORT-03: Missing-param exclusion on both axes
- SORT-04: gridSpacing controls column and row separation
- SORT-05: All worldX and worldY are exact multiples of gridSpacing (literal assertion)
- D-04: LoRA count bucketing (0-LoRA assets NOT excluded)
- isSortableParamKey / SORTABLE_PARAM_KEYS utility

## Algorithm Notes

### `extractSortValue`

The `switch` on `ParamKey` handles each case explicitly:

- `loras` → `params.loras.length` (always a number, even 0; 0-LoRA assets are valid)
- Numeric fields (`cfg`, `steps`, `seed`, `width`, `height`, `timestamp`) → `Number.isFinite` guard before returning (threat T-03-03-02: non-finite numbers treated as undefined)
- String fields (`model`, `sampler`, `scheduler`) → returned as-is
- Non-sortable keys (`positivePrompt`, `negativePrompt`, `favourite`, `tags`, `resolution`) → `undefined`

### `compareGroupKeys`

Two serialized bucket keys are compared numerically if both `Number.isFinite(Number(key))`, otherwise alphabetically. This correctly handles:

- CFG values: `"10"`, `"2"`, `"7"` sort as `2, 7, 10` (numeric)
- Sampler names: `"euler_a"`, `"dpmpp_2m"`, `"euler"` sort as `dpmpp_2m, euler, euler_a` (alphabetic)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Adaptation] Updated makeParams helper to match actual NormalizedParams shape**

- **Found during:** Task 2 typecheck
- **Issue:** The plan's example `makeParams` used `workflowFingerprint: undefined`, but the actual `NormalizedParams` (Zod-inferred from `paramNormalize.ts`) has `workflowFingerprint: string` (required) and `workflowFilename: string | null` (required)
- **Fix:** Updated `makeParams` default values to `workflowFingerprint: ''` and `workflowFilename: null`
- **Files modified:** `sortMath.test.ts`
- **Commit:** c54f4d7f0

None — all plan-specified logic implemented exactly as specified.

## Known Stubs

None — `sortMath.ts` is a complete, fully-tested pure math module with no placeholder values or TODO stubs.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries introduced.

## Self-Check: PASSED

- `src/platform/moshpit/services/sortMath.ts` — FOUND
- `src/platform/moshpit/services/sortMath.test.ts` — FOUND
- Commit `1718e80a2` (RED tests) — FOUND
- Commit `c54f4d7f0` (GREEN impl) — FOUND
- All 33 tests pass — VERIFIED
- `pnpm typecheck` — no errors in new files
- oxlint on sortMath files — 0 warnings, 0 errors
