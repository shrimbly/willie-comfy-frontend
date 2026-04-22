/**
 * Pure parameter-diff math for the metadata peek panel (Plan 05-02; PEEK-02 +
 * PEEK-03). Worker-safe: no Vue, no Pinia, no DOM. The only permitted runtime
 * import is `es-toolkit`'s `sortBy`; `NormalizedParams` comes in as a
 * type-only import.
 *
 * Downstream consumer: `MoshpitMetadataPeekPanel.vue` (Plan 05-05) renders
 * `ParamDiffRow[]` above the LoRA section; uses `t('moshpit.peek.params.' +
 * row.key)` for labels and the semantic diff tokens per D-21.
 */
import { sortBy } from 'es-toolkit'

import type { NormalizedParams } from './paramNormalize'

// ---------------------------------------------------------------------------
// Scalar param diff
// ---------------------------------------------------------------------------

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

/**
 * Canonical render order for the peek panel. Matches the field declaration
 * order of `NormalizedParamsSchema` minus `loras`, which is rendered via
 * `diffLoras` in a separate section.
 *
 * KEEP ALIGNED with `NormalizedParamsSchema` in `paramNormalize.ts`. The
 * `PARAM_DIFF_KEY_ORDER` test enforces key-set parity against the live type
 * so adding a new scalar field to NormalizedParams will fail the test until
 * it's inserted here in the right place.
 */
export const PARAM_DIFF_KEY_ORDER: readonly ParamDiffKey[] = [
  'model',
  'cfg',
  'steps',
  'sampler',
  'scheduler',
  'seed',
  'width',
  'height',
  'positivePrompt',
  'negativePrompt',
  'timestamp',
  'workflowFingerprint',
  'workflowFilename',
  'saveNodeIdentity'
]

function isParamMissing(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

/**
 * Classify each scalar key in `PARAM_DIFF_KEY_ORDER` as
 * `match | differ | onlyA | onlyB | missingBoth`. `undefined`, `null`, and
 * empty-string are all treated as "missing" so absent-vs-"" does not surface
 * as a false `differ` row.
 */
export function diffParams(
  a: NormalizedParams,
  b: NormalizedParams
): readonly ParamDiffRow[] {
  return PARAM_DIFF_KEY_ORDER.map((key) => {
    const valueA = a[key]
    const valueB = b[key]
    const aMissing = isParamMissing(valueA)
    const bMissing = isParamMissing(valueB)
    let state: ParamDiffState
    if (aMissing && bMissing) state = 'missingBoth'
    else if (aMissing) state = 'onlyB'
    else if (bMissing) state = 'onlyA'
    else state = valueA === valueB ? 'match' : 'differ'
    return { key, state, valueA, valueB }
  })
}

// ---------------------------------------------------------------------------
// LoRA set diff — name-based, order-insensitive (PEEK-03 literal)
// ---------------------------------------------------------------------------

export type LoraDiffState = 'match' | 'weightChanged' | 'added' | 'removed'

export interface LoraDiffEntry {
  readonly name: string
  readonly state: LoraDiffState
  readonly weightA: number | null
  readonly weightB: number | null
}

/**
 * Name-based, order-insensitive set diff over two LoRA arrays.
 *
 * Duplicate-name semantics: last-weight-wins during Map construction. Upstream
 * `paramNormalize.extractLoras` is not formally required to uniqify by name,
 * so this belt-and-braces choice keeps the diff deterministic even if a
 * workflow contains two LoraLoader nodes referencing the same file.
 *
 * Output is sorted by (state, name) — stable and alphabetical within each
 * state group — so the peek panel renders the same row order regardless of
 * the original array ordering (fast-check property test enforces this).
 */
export function diffLoras(
  a: readonly { readonly name: string; readonly weight: number }[],
  b: readonly { readonly name: string; readonly weight: number }[]
): readonly LoraDiffEntry[] {
  const byA = new Map<string, number>()
  for (const lora of a) byA.set(lora.name, lora.weight)
  const byB = new Map<string, number>()
  for (const lora of b) byB.set(lora.name, lora.weight)

  const names = new Set<string>([...byA.keys(), ...byB.keys()])
  const rows: LoraDiffEntry[] = []
  for (const name of names) {
    const hasA = byA.has(name)
    const hasB = byB.has(name)
    if (hasA && hasB) {
      const weightA = byA.get(name)!
      const weightB = byB.get(name)!
      rows.push({
        name,
        state: weightA === weightB ? 'match' : 'weightChanged',
        weightA,
        weightB
      })
    } else if (hasA) {
      rows.push({
        name,
        state: 'removed',
        weightA: byA.get(name)!,
        weightB: null
      })
    } else {
      rows.push({
        name,
        state: 'added',
        weightA: null,
        weightB: byB.get(name)!
      })
    }
  }
  return sortBy(rows, ['state', 'name'])
}
