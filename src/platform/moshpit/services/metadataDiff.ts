/**
 * Pure parameter-diff math for the metadata peek panel (PEEK-02 + PEEK-03).
 *
 * STUB — Task 1 RED. Task 2 GREEN replaces with real implementation.
 *
 * Required to satisfy ESLint `import-x/no-unresolved` on the RED test commit
 * (see Plan 05-01 SUMMARY — Deviation 2).
 */
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

export const PARAM_DIFF_KEY_ORDER: readonly ParamDiffKey[] = []

export type LoraDiffState = 'match' | 'weightChanged' | 'added' | 'removed'

export interface LoraDiffEntry {
  readonly name: string
  readonly state: LoraDiffState
  readonly weightA: number | null
  readonly weightB: number | null
}

function notImplemented(): never {
  throw new Error('metadataDiff: not implemented (RED stub)')
}

export function diffParams(
  _a: NormalizedParams,
  _b: NormalizedParams
): readonly ParamDiffRow[] {
  return notImplemented()
}

export function diffLoras(
  _a: readonly { readonly name: string; readonly weight: number }[],
  _b: readonly { readonly name: string; readonly weight: number }[]
): readonly LoraDiffEntry[] {
  return notImplemented()
}
