---
phase: 03-filter-sort-core-validation
plan: '02'
subsystem: moshpit/filter
tags: [moshpit, filter, predicate, pure-math, tdd]
dependency_graph:
  requires: []
  provides:
    - filterTypes.ts (ParamKey, ChipValue, FilterChip, TimePreset, TimeRange, TIME_PRESETS)
    - filterMath.ts (applyFilterChips, matchesChip, matchesTimeRange, getDateRangeForPreset)
    - paramNormalize.ts (NormalizedParams, normalizeParams, emptyParams, extractWorkflowFilename)
  affects:
    - 03-05 (filter store consumes filterMath + filterTypes)
    - 03-06 (useMoshpitFilteredAssets calls applyFilterChips)
    - 03-07 (workflow picker uses ParamKey + TimeRange)
tech_stack:
  added: []
  patterns:
    - Pure predicate module with injected nowMs for testability
    - Discriminated union ChipValue with exhaustiveness guard
    - OR-within-chip / AND-across-chips semantics (D-12)
    - String.includes for text chips (no RegExp — T-03-02-02)
key_files:
  created:
    - src/platform/moshpit/services/filterTypes.ts
    - src/platform/moshpit/services/filterMath.ts
    - src/platform/moshpit/services/filterMath.test.ts
    - src/platform/moshpit/services/paramNormalize.ts
  modified: []
decisions:
  - nowMs injected into all time-range predicates; no Date.now() inside the module
  - String.includes used for text chip (not RegExp) to prevent O(N) DoS via pathological patterns
  - Exhaustiveness guard via `const _exhaustive never = val` on ChipValue discriminated union
  - DEFAULT_CURATION object freeze used for hashes absent from hashToCuration map
metrics:
  duration_seconds: 382
  completed_date: '2026-04-20'
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 03 Plan 02: Filter Predicate Math Summary

**One-liner:** Pure `filterMath.ts` predicate module implementing OR-within-chip / AND-across-chips semantics with injected `nowMs` for deterministic time-range testing.

## What Was Built

Two modules and a comprehensive test suite:

**`filterTypes.ts`** — Shared domain types for the entire filter subsystem:

- `ParamKey` — 15 parameter keys (model, loras, cfg, steps, sampler, scheduler, seed, positivePrompt, negativePrompt, width, height, timestamp, favourite, tags, resolution)
- `ChipValue` — Discriminated union of 5 chip kinds: `numeric` | `categorical` | `text` | `resolution` | `boolean`
- `FilterChip` — `{ id, param, value }` interface
- `TimePreset` / `TimeRange` — Time window types
- `TIME_PRESETS` — Readonly array constant

**`filterMath.ts`** — Pure predicate module with 4 exported functions:

- `applyFilterChips(hashToParams, hashToCuration, chips, showHidden, timeRange, nowMs)` → `readonly string[]`
- `matchesChip(params, curation, chip)` → `boolean`
- `matchesTimeRange(timestamp, range, nowMs)` → `boolean`
- `getDateRangeForPreset(preset, nowMs)` → `{ from, to } | null`

**`paramNormalize.ts`** — Worker-safe NormalizedParams extraction (created as dependency for filterMath; updated by parallel 03-01 agent with Zod schema and `workflowFingerprint`/`workflowFilename` fields).

## Public API

```typescript
// filterTypes.ts
export type ParamKey = 'model' | 'loras' | 'cfg' | 'steps' | 'sampler' | 'scheduler'
  | 'seed' | 'positivePrompt' | 'negativePrompt' | 'width' | 'height'
  | 'timestamp' | 'favourite' | 'tags' | 'resolution'

export type ChipValue =
  | { kind: 'numeric'; min: number | null; max: number | null; exact: number | null }
  | { kind: 'categorical'; values: readonly string[] }
  | { kind: 'text'; substring: string }
  | { kind: 'resolution'; pairs: readonly (readonly [number, number])[] }
  | { kind: 'boolean'; value: boolean }

export interface FilterChip { id: string; param: ParamKey; value: ChipValue }
export interface TimeRange { preset: TimePreset; from: number | null; to: number | null }

// filterMath.ts
export function applyFilterChips(...): readonly string[]
export function matchesChip(...): boolean
export function matchesTimeRange(...): boolean
export function getDateRangeForPreset(...): { from: number; to: number } | null
```

## Test Coverage

64 `it()` blocks across 18 `describe()` groups covering all 9 FILTER requirements:

| Requirement                                             | Tests                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| FILTER-02 (model)                                       | Categorical single-value, multi-value OR                                     |
| FILTER-03 (LoRA)                                        | Name match, empty array, OR within chip                                      |
| FILTER-04 (CFG/steps/sampler/scheduler/seed/resolution) | Numeric range, boundary, open bounds, exact, resolution pairs                |
| FILTER-05 (prompt substring)                            | Case-insensitive, positive vs negative                                       |
| FILTER-06 (time)                                        | All presets + custom, boundary inclusive                                     |
| FILTER-07 (tags + favourite)                            | Boolean, categorical tags, OR within chip                                    |
| FILTER-08 (subtractive)                                 | Excluded hashes absent not dimmed                                            |
| FILTER-09 (silently null)                               | undefined params excluded for all chip types                                 |
| FILTER-11 (showHidden)                                  | hidden=false default, hidden=true reveal, absent curation treated as default |
| D-12 (OR/AND semantics)                                 | Multi-value single chip = OR; multi-chip = AND                               |

**Critical semantic pair tested (FILTER-09 + D-12):**

- `chip { param: 'sampler', values: ['euler', 'dpmpp_2m'] }` → matches either (OR within chip)
- Two chips `[{ sampler: 'euler' }, { model: 'sd_xl' }]` → must match both (AND across)
- `chip { param: 'cfg', min: 6, max: 8 }` with `params.cfg = undefined` → excluded (FILTER-09)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] paramNormalize.ts stub needed before filterMath implementation**

- **Found during:** Task 1 setup
- **Issue:** `paramNormalize.ts` was not yet created by the parallel 03-01 agent at task start time; `filterMath.ts` imports `NormalizedParams` type from it
- **Fix:** Created `paramNormalize.ts` with full implementation; later superseded by 03-01 agent's Zod-based version which added `workflowFingerprint: string` (required) and `workflowFilename: string | null` fields
- **Files modified:** `src/platform/moshpit/services/paramNormalize.ts`
- **Impact:** Test factory `params()` updated to include `workflowFingerprint: ''` and `workflowFilename: null` defaults; the `paramNormalize.ts` from 03-01 takes precedence

**2. [Rule 1 - Bug] Test factory used `workflowFingerprint: undefined` incompatible with Zod-inferred type**

- **Found during:** Task 2 (after 03-01 agent updated paramNormalize.ts)
- **Issue:** The 03-01 Zod schema makes `workflowFingerprint` required (not optional), causing a type mismatch in the test factory
- **Fix:** Updated `params()` factory defaults to `workflowFingerprint: ''` and `workflowFilename: null`
- **Files modified:** `src/platform/moshpit/services/filterMath.test.ts`

## Known Stubs

None — all filter predicates are fully implemented and tested.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced.
This plan is purely in-memory math with no side effects.

## Self-Check: PASSED

- `src/platform/moshpit/services/filterTypes.ts` — FOUND
- `src/platform/moshpit/services/filterMath.ts` — FOUND
- `src/platform/moshpit/services/filterMath.test.ts` — FOUND
- Commit `50b9be4` (RED: test + types) — FOUND
- Commit `7469579` (GREEN: implementation) — FOUND
- All 64 tests pass
- No `any` type in filterMath.ts
- No `Date.now()` in filterMath.ts
- No forbidden imports in filterMath.ts
- oxlint: 0 warnings, 0 errors on our files
