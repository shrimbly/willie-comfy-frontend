/**
 * Shared domain types for the Moshpit filter/sort system (Phase 3).
 *
 * This module is a pure-type leaf so both worker-side and main-thread code can
 * import it without pulling runtime dependencies. filterMath.ts consumes these
 * types; the Pinia filter store and UI components consume them too.
 *
 * Per CONTEXT.md D-11 chip value editors and D-12 OR/AND semantics.
 */

export type ParamKey =
  | 'model'
  | 'loras'
  | 'cfg'
  | 'steps'
  | 'sampler'
  | 'scheduler'
  | 'seed'
  | 'positivePrompt'
  | 'negativePrompt'
  | 'width'
  | 'height'
  | 'timestamp'
  | 'favourite'
  | 'tags'
  | 'resolution'

export type ChipValue =
  | {
      readonly kind: 'numeric'
      readonly min: number | null
      readonly max: number | null
      readonly exact: number | null
    }
  | { readonly kind: 'categorical'; readonly values: readonly string[] }
  | { readonly kind: 'text'; readonly substring: string }
  | {
      readonly kind: 'resolution'
      readonly pairs: readonly (readonly [number, number])[]
    }
  | { readonly kind: 'boolean'; readonly value: boolean }

export interface FilterChip {
  readonly id: string
  readonly param: ParamKey
  readonly value: ChipValue
}

export type TimePreset = 'today' | 'thisWeek' | 'thisMonth' | 'all' | 'custom'

export interface TimeRange {
  readonly preset: TimePreset
  readonly from: number | null
  readonly to: number | null
}

export const TIME_PRESETS: readonly TimePreset[] = [
  'today',
  'thisWeek',
  'thisMonth',
  'all',
  'custom'
]
