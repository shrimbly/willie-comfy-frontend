/**
 * Pure filter predicate math (Phase 3).
 *
 * Semantics (CONTEXT.md D-12): OR within a multi-value chip; AND across chips.
 * Semantics (CONTEXT.md D-03 / FILTER-09): missing params silently null — the
 * predicate returns false, so the asset drops from the filtered set.
 *
 * Determinism for testability: `nowMs` is injected — no `Date.now()` inside
 * predicates. Callers (moshpitFilterStore) supply Date.now() at call time.
 *
 * Performance: applyFilterChips is O(N × chips) over N assets. Safe at 5k
 * assets × ≤10 chips × O(1) per-chip cost well inside a 16ms frame budget.
 *
 * Security (T-03-02-02): text chip uses String.includes, NOT RegExp, to prevent
 * pathological regex denial of service. O(N×M) worst case is bounded by the
 * 5k asset cap and chip string length.
 */

import type { CurationRecord } from './thumbRepository.types'
import type {
  ChipValue,
  FilterChip,
  TimePreset,
  TimeRange
} from './filterTypes'
import type { NormalizedParams } from './paramNormalize'

const DAY_MS = 86_400_000

const DEFAULT_CURATION: CurationRecord = Object.freeze({
  favourite: false,
  tags: [],
  folders: [],
  hidden: false
})

// ---------------------------------------------------------------------------
// Time range
// ---------------------------------------------------------------------------

/**
 * Returns the [from, to] epoch-ms window for a given preset, or null for 'all'
 * and 'custom' (callers use TimeRange.from/to directly for 'custom').
 */
export function getDateRangeForPreset(
  preset: TimePreset,
  nowMs: number
): { readonly from: number; readonly to: number } | null {
  switch (preset) {
    case 'all':
      return null
    case 'today':
      return { from: nowMs - DAY_MS, to: nowMs }
    case 'thisWeek':
      return { from: nowMs - 7 * DAY_MS, to: nowMs }
    case 'thisMonth':
      return { from: nowMs - 30 * DAY_MS, to: nowMs }
    case 'custom':
      return null // caller uses range.from / range.to directly
  }
}

/**
 * Returns true if `timestamp` falls within the given time range window.
 * Boundaries are inclusive.
 */
export function matchesTimeRange(
  timestamp: number,
  range: TimeRange,
  nowMs: number
): boolean {
  if (range.preset === 'all') return true

  if (range.preset === 'custom') {
    const fromOk = range.from === null || timestamp >= range.from
    const toOk = range.to === null || timestamp <= range.to
    return fromOk && toOk
  }

  const window = getDateRangeForPreset(range.preset, nowMs)
  if (!window) return true
  return timestamp >= window.from && timestamp <= window.to
}

// ---------------------------------------------------------------------------
// Per-chip predicate
// ---------------------------------------------------------------------------

/**
 * Returns true if the given params + curation pass the chip's predicate.
 *
 * OR semantics within a multi-value chip (D-12): for categorical/resolution
 * chips, any matching value causes a match. AND semantics across chips is
 * enforced by the caller (applyFilterChips).
 *
 * Missing params (D-03 / FILTER-09): undefined fields return false — the asset
 * is excluded whenever a chip queries a field the asset lacks.
 */
export function matchesChip(
  params: NormalizedParams,
  curation: CurationRecord,
  chip: FilterChip
): boolean {
  const val = chip.value
  switch (val.kind) {
    case 'categorical':
      return matchesCategoricalChip(params, curation, chip.param, val)

    case 'numeric':
      return matchesNumericChip(params, chip.param, val)

    case 'text':
      return matchesTextChip(params, chip.param, val)

    case 'resolution':
      return matchesResolutionChip(params, val)

    case 'boolean':
      return matchesBooleanChip(curation, chip.param, val)

    default: {
      // Exhaustiveness guard (T-03-02-03)
      const _exhaustive: never = val
      return _exhaustive
    }
  }
}

// ---------------------------------------------------------------------------
// Chip kind implementations
// ---------------------------------------------------------------------------

function matchesCategoricalChip(
  params: NormalizedParams,
  curation: CurationRecord,
  param: FilterChip['param'],
  val: Extract<ChipValue, { kind: 'categorical' }>
): boolean {
  // LoRA: name-only match, any weight (D-04), OR within chip
  if (param === 'loras') {
    if (params.loras.length === 0) return false
    return val.values.some((name) => params.loras.some((l) => l.name === name))
  }

  // Tags: read from curation, OR within chip
  if (param === 'tags') {
    return val.values.some((tag) => curation.tags.includes(tag))
  }

  // Other categorical params (model, sampler, scheduler, etc.)
  const paramVal = getCategoricalParamValue(params, param)
  if (paramVal === undefined) return false
  // OR within chip: includes uses strict equality for string values
  return val.values.includes(paramVal)
}

function matchesNumericChip(
  params: NormalizedParams,
  param: FilterChip['param'],
  val: Extract<ChipValue, { kind: 'numeric' }>
): boolean {
  const paramVal = getNumericParamValue(params, param)
  if (paramVal === undefined) return false

  if (val.exact !== null) return paramVal === val.exact

  const minOk = val.min === null || paramVal >= val.min
  const maxOk = val.max === null || paramVal <= val.max
  return minOk && maxOk
}

function matchesTextChip(
  params: NormalizedParams,
  param: FilterChip['param'],
  val: Extract<ChipValue, { kind: 'text' }>
): boolean {
  // Only positivePrompt and negativePrompt support text chips
  let text: string | undefined
  if (param === 'positivePrompt') {
    text = params.positivePrompt
  } else if (param === 'negativePrompt') {
    text = params.negativePrompt
  } else {
    return false
  }

  if (text === undefined || text.length === 0) return false
  // Case-insensitive substring match (String.includes — no RegExp, T-03-02-02)
  return text.toLowerCase().includes(val.substring.toLowerCase())
}

function matchesResolutionChip(
  params: NormalizedParams,
  val: Extract<ChipValue, { kind: 'resolution' }>
): boolean {
  if (params.width === undefined || params.height === undefined) return false
  const { width, height } = params
  // OR within chip: any matching pair
  return val.pairs.some(([w, h]) => width === w && height === h)
}

function matchesBooleanChip(
  curation: CurationRecord,
  param: FilterChip['param'],
  val: Extract<ChipValue, { kind: 'boolean' }>
): boolean {
  if (param === 'favourite') {
    return curation.favourite === val.value
  }
  return false
}

// ---------------------------------------------------------------------------
// Param value extractors
// ---------------------------------------------------------------------------

function getCategoricalParamValue(
  params: NormalizedParams,
  param: FilterChip['param']
): string | undefined {
  switch (param) {
    case 'model':
      return params.model
    case 'sampler':
      return params.sampler
    case 'scheduler':
      return params.scheduler
    case 'saveNode':
      return params.saveNodeIdentity ?? undefined
    // Params handled by matchesChip's dedicated branches — these never reach
    // the categorical lookup path, but listing them keeps the switch exhaustive
    // so future ParamKey additions surface as compile errors (T-04-03-01).
    case 'loras':
    case 'tags':
    case 'favourite':
    case 'resolution':
    case 'positivePrompt':
    case 'negativePrompt':
    case 'cfg':
    case 'steps':
    case 'seed':
    case 'width':
    case 'height':
    case 'timestamp':
      return undefined
    default: {
      const _exhaustive: never = param
      return _exhaustive
    }
  }
}

function getNumericParamValue(
  params: NormalizedParams,
  param: FilterChip['param']
): number | undefined {
  switch (param) {
    case 'cfg':
      return params.cfg
    case 'steps':
      return params.steps
    case 'seed':
      return params.seed
    case 'width':
      return params.width
    case 'height':
      return params.height
    // Non-numeric params — listed explicitly so ParamKey widenings become
    // compile errors rather than silent undefined fall-through (T-04-03-01).
    case 'model':
    case 'loras':
    case 'sampler':
    case 'scheduler':
    case 'positivePrompt':
    case 'negativePrompt':
    case 'timestamp':
    case 'favourite':
    case 'tags':
    case 'resolution':
    case 'saveNode':
      return undefined
    default: {
      const _exhaustive: never = param
      return _exhaustive
    }
  }
}

// ---------------------------------------------------------------------------
// Top-level filter application
// ---------------------------------------------------------------------------

/**
 * Apply the full filter set to a map of assets.
 *
 * Returns only the content hashes that pass ALL of:
 *   1. showHidden gate (FILTER-11)
 *   2. time range (FILTER-06)
 *   3. every chip (AND across chips, D-12)
 *
 * Result is a flat array of hashes; order is map iteration order.
 * Excluded assets are absent (FILTER-08), not dimmed.
 *
 * Performance: O(N × chips), pure, no reactive dependencies — safe to call
 * from a computed property without putting 5k NormalizedParams on Pinia's
 * reactive graph.
 */
export function applyFilterChips(
  hashToParams: ReadonlyMap<string, NormalizedParams>,
  hashToCuration: ReadonlyMap<string, CurationRecord>,
  chips: readonly FilterChip[],
  showHidden: boolean,
  timeRange: TimeRange,
  nowMs: number
): readonly string[] {
  const result: string[] = []

  for (const [hash, p] of hashToParams) {
    const cur = hashToCuration.get(hash) ?? DEFAULT_CURATION

    // FILTER-11: hidden gate
    if (!showHidden && cur.hidden) continue

    // FILTER-06: time range gate
    if (!matchesTimeRange(p.timestamp, timeRange, nowMs)) continue

    // FILTER-02/03/04/05/07/09: chip predicates (AND across chips)
    let pass = true
    for (const c of chips) {
      if (!matchesChip(p, cur, c)) {
        pass = false
        break
      }
    }

    if (pass) result.push(hash)
  }

  return result
}
