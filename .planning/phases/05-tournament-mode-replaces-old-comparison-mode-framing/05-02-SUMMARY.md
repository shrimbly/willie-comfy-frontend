---
phase: 05
plan: 02
subsystem: moshpit-tournament-peek
tags: [moshpit, tournament, peek, pure-math, tdd, fast-check]
requires:
  - 'NormalizedParams from src/platform/moshpit/services/paramNormalize.ts (type-only)'
provides:
  - 'diffParams(a, b): readonly ParamDiffRow[]'
  - 'diffLoras(a, b): readonly LoraDiffEntry[]'
  - 'PARAM_DIFF_KEY_ORDER: readonly ParamDiffKey[]'
  - 'ParamDiffKey / ParamDiffState / ParamDiffRow / LoraDiffState / LoraDiffEntry types'
affects: []
tech-stack:
  added: []
  patterns:
    - 'Pure worker-safe service module (mirrors groupAxes.ts / tournamentBracket.ts)'
    - 'fast-check permutation-invariance property test (PEEK-03 literal)'
    - 'es-toolkit sortBy for stable (state, name) ordering'
key-files:
  created:
    - 'src/platform/moshpit/services/metadataDiff.ts'
    - 'src/platform/moshpit/services/metadataDiff.test.ts'
  modified: []
decisions:
  - 'Missing-value semantics: undefined, null, and empty-string all classify as "missing" so absent-vs-"" does not surface as a false differ row.'
  - 'Duplicate-name LoRA semantics: last-weight-wins during Map construction. Upstream paramNormalize.extractLoras is not formally required to uniqify, so this belt-and-braces choice keeps diffLoras deterministic without a crash path.'
  - 'LoRA output sort is sortBy(["state", "name"]) — states sort lexicographically (added < match < removed < weightChanged), names alphabetical within each state group. Tests snapshot the concrete order so the state-string sort behaviour is pinned.'
  - 'PARAM_DIFF_KEY_ORDER omits loras; the peek panel renders the LoRA section separately via diffLoras per D-21.'
  - 'RED commit shipped a notImplemented() stub metadataDiff.ts so ESLint import-x/no-unresolved would not reject the test-first commit — identical pattern to Plan 05-01.'
metrics:
  duration: ~3min
  completed: 2026-04-22
  tasks: 2
  files: 2
  commits:
    - 'b5df2fe89 test(05-02): add failing param + LoRA diff tests'
    - 'b695eeed2 feat(05-02): implement metadata diff pure module'
---

# Phase 5 Plan 02: Metadata Diff Pure Module Summary

Name-based, order-insensitive LoRA set-diff and scalar-param classifier for
the Plan 05-05 metadata peek panel — fast-check property-tested for PEEK-03
permutation-invariance.

## Final API Surface

```typescript
import type { NormalizedParams } from './paramNormalize'

export type ParamDiffKey = Exclude<keyof NormalizedParams, 'loras'>

export type ParamDiffState =
  | 'match'
  | 'differ'
  | 'onlyA'
  | 'onlyB'
  | 'missingBoth'

export interface ParamDiffRow {
  readonly key: ParamDiffKey
  readonly state: ParamDiffState
  readonly valueA: unknown
  readonly valueB: unknown
}

export const PARAM_DIFF_KEY_ORDER: readonly ParamDiffKey[]

export function diffParams(
  a: NormalizedParams,
  b: NormalizedParams
): readonly ParamDiffRow[]

export type LoraDiffState = 'match' | 'weightChanged' | 'added' | 'removed'

export interface LoraDiffEntry {
  readonly name: string
  readonly state: LoraDiffState
  readonly weightA: number | null
  readonly weightB: number | null
}

export function diffLoras(
  a: readonly { readonly name: string; readonly weight: number }[],
  b: readonly { readonly name: string; readonly weight: number }[]
): readonly LoraDiffEntry[]
```

## Signature Deviations from Plan `<interfaces>`

None. The shipped API matches the plan contract exactly.

## Duplicate-Name LoRA Semantics

`diffLoras` builds two `Map<string, number>` by iterating inputs in order and
calling `set(name, weight)` — the last occurrence of a duplicate name wins
both during A→Map and B→Map construction. Rationale:

- `paramNormalize.extractLoras` loops `findAllNodesByClassTypes(graph,
LORA_CLASS_TYPES)` and does not uniqify by name. Two `LoraLoader` nodes
  pointing at the same checkpoint file would yield duplicates.
- Crash-on-duplicate would propagate to the peek panel render; last-wins
  preserves determinism and keeps diff math total.
- Documented in a dedicated test (`'duplicate name within a single input —
last-weight-wins semantics'`) so any future semantic flip (e.g. sum-weights,
  error-on-duplicate) shows up as a test failure.

## PARAM_DIFF_KEY_ORDER

Exported as `readonly ParamDiffKey[]` — the render order for the peek panel:

```
model, cfg, steps, sampler, scheduler, seed,
width, height, positivePrompt, negativePrompt,
timestamp, workflowFingerprint, workflowFilename, saveNodeIdentity
```

Matches `NormalizedParamsSchema` field declaration order in `paramNormalize.ts`
minus `loras`. The **PARAM_DIFF_KEY_ORDER** test asserts key-set parity
against the live `NormalizedParams` type, so adding a new scalar field to
`NormalizedParamsSchema` fails Plan 05-02's test suite until the key is
inserted here in the right render position.

## Missing-Value Semantics (scalar diff)

`undefined`, `null`, and `''` all classify as "missing". Makes absent-vs-`""`
not show up as a false `differ` row when one asset's metadata truly lacks a
field and another has an empty optional.

| A missing | B missing | State                  |
| --------- | --------- | ---------------------- |
| yes       | yes       | `missingBoth`          |
| yes       | no        | `onlyB`                |
| no        | yes       | `onlyA`                |
| no        | no        | `=== ? match : differ` |

Equality for the "both present" case is `===` — safe because
`NormalizedParams` scalars are `string | number | null | undefined`, never
objects.

## Test Coverage (22 tests, 2 fast-check properties)

| Describe block           | Tests | Notes                                                             |
| ------------------------ | ----- | ----------------------------------------------------------------- |
| `PARAM_DIFF_KEY_ORDER`   | 2     | Key-set parity vs NormalizedParams + loras excluded               |
| `diffParams`             | 8     | Identical / differ / onlyA / onlyB / missingBoth + row order      |
| `diffLoras`              | 10    | Concrete cases, sort order, duplicate-name, 2× fast-check         |
| `pure-module invariants` | 2     | No vue / pinia / `@/` runtime imports; type-only NormalizedParams |

## fast-check Properties

1. **Reverse-shuffle invariance** — For uniquified arrays `A` and `B`,
   `diffLoras(reverse(A), B)`, `diffLoras(A, reverse(B))`, and
   `diffLoras(reverse(A), reverse(B))` all deep-equal `diffLoras(A, B)`. 50 runs.
2. **Random-shuffle invariance (fc.shuffledSubarray)** — For uniquified arrays
   `A` and `B`, `diffLoras(shuffled(A), shuffled(B))` deep-equals
   `diffLoras(A, B)`. 50 runs. Uses `fc.shuffledSubarray(arr, { minLength:
arr.length, maxLength: arr.length })` which is the canonical "full
   permutation" primitive.

Arbitrary: 4-char alphabet `fc.string({ minLength: 1, maxLength: 4 })` forces
name collisions between A and B so the `match` / `weightChanged` branches are
exercised by the property tests; weights are `fc.float({ noNaN: true, min:
-2, max: 2 })` to stay in a realistic LoRA-weight range.

No counterexamples surfaced during development; default shrinking left.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint `import-x/no-unresolved` would block the pure RED commit**

- **Found during:** Task 1 RED commit planning
- **Issue:** Plan 05-01 SUMMARY documented that a true file-missing RED commit
  is rejected by the husky pre-commit ESLint step — lint-staged does not
  revert the commit cleanly.
- **Fix:** Shipped the RED commit with a `notImplemented()` stub
  `metadataDiff.ts` exporting the full API surface (types + constants + throw
  stubs). 19 of 22 tests still fail with "not implemented"; only the 3 pure
  module + key-set tests that don't call the functions pass at RED.
- **Files modified:** `src/platform/moshpit/services/metadataDiff.ts`
- **Commit:** Folded into RED commit `b5df2fe89`

**2. [Rule 1 - Lint] Import-sort linter rewrote the `LoraDiffEntry` import**

- **Found during:** Task 1 RED commit via husky `eslint --fix`
- **Issue:** ESLint's `import/consistent-type-specifier-style: prefer-top-level`
  split my combined `import { ..., type LoraDiffEntry }` into two lines.
- **Fix:** Accepted the linter's auto-fix; behaviour unchanged.
- **Files modified:** `src/platform/moshpit/services/metadataDiff.test.ts`
- **Commit:** Folded into RED commit `b5df2fe89`

No architectural changes required. No auth gates. No CLAUDE.md directives
violated.

## Notes for Plan 05-05 Executor (MoshpitMetadataPeekPanel.vue)

Rendering contract:

```typescript
import {
  diffLoras,
  diffParams,
  PARAM_DIFF_KEY_ORDER
} from '@/platform/moshpit/services/metadataDiff'

const paramRows = computed(() => diffParams(pair.value.a, pair.value.b))
const loraRows = computed(() =>
  diffLoras(pair.value.a.loras, pair.value.b.loras)
)
```

Label lookup per D-22:

```typescript
// template — i18n-scoped: moshpit.peek.params.<key>
// e.g. moshpit.peek.params.cfg, moshpit.peek.params.positivePrompt, …
t(`moshpit.peek.params.${row.key}`)
```

Diff state tokens (D-21) — confirm against the Comfy Design Standards Figma
before hardcoding; the fallback-safe mapping is:

| State         | Tailwind                                          |
| ------------- | ------------------------------------------------- |
| `match`       | plain row, `text-foreground`                      |
| `differ`      | `bg-node-component-surface` + icon in left gutter |
| `onlyA`       | `text-warning`                                    |
| `onlyB`       | `text-warning`                                    |
| `missingBoth` | `text-muted-foreground`                           |

| LoRA state      | Tailwind          |
| --------------- | ----------------- |
| `match`         | `text-foreground` |
| `weightChanged` | `text-warning`    |
| `added`         | `text-success`    |
| `removed`       | `text-danger`     |

Never `v-html` any `ParamDiffRow.valueA` / `valueB` — use Vue text
interpolation (`{{ row.valueA }}`). Threat T-05-02-02 is transferred to Plan
05-05 as an XSS risk if prompt text is rendered unsanitised.

Render LoRA rows as `{{ entry.name }} @ {{ entry.weightA ?? '—' }} →
{{ entry.weightB ?? '—' }}` per D-22.

## Verification

- `pnpm test:unit -- --run src/platform/moshpit/services/metadataDiff.test.ts`
  → 22/22 passing
- `pnpm typecheck` ran clean via the husky pre-commit hook on both RED and
  GREEN commits
- Pure-module invariant test scans the on-disk `metadataDiff.ts` source for
  `from 'vue'` / `from 'pinia'` / `from '@/'` after stripping `import type`
  lines — passes.

## Self-Check

- `src/platform/moshpit/services/metadataDiff.ts` — FOUND
- `src/platform/moshpit/services/metadataDiff.test.ts` — FOUND
- Commit `b5df2fe89` (RED) — FOUND
- Commit `b695eeed2` (GREEN) — FOUND
- All 22 tests pass under `pnpm test:unit -- --run
src/platform/moshpit/services/metadataDiff.test.ts`
- Pure-module invariant: no vue / pinia / `@/` runtime imports in
  `metadataDiff.ts`

## Self-Check: PASSED
