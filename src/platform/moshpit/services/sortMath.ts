/**
 * Pure sort layout math (Phase 3, CONTEXT.md D-15 / D-16 / D-17, SORT-01..05).
 *
 * Column-per-unique-value bucketing: discrete and continuous parameters are
 * grouped by serialized value; numeric values sort numerically, categorical
 * values sort alphabetically. Assets lacking the sorted parameter are
 * excluded from the output (matches the D-17 "same as filter exclusion" rule).
 *
 * SORT-05 literal: every output worldX and worldY is an exact integer multiple
 * of gridSpacing. 2D same-cell stacking uses ROW-BAND ACCUMULATION rather than
 * sub-cell offsets — see computeSortedLayout2D below.
 *
 * Coordinate system matches layoutMath.ts: world-space pixels inside
 * pixi-viewport.
 *
 * Phase 4 reuse note (2026-04-21): After the v3 pivot, parameter-axis sort UI
 * is removed, but the grid-packing primitives in this module remain part of
 * the cluster-layout substrate. See `clusterLayout.ts` and D-16 in
 * `.planning/phases/04-lineage-groupings-within-cluster-sort/04-CONTEXT.md`.
 */

import type { GridSlot } from './layoutMath'
import type { ParamKey } from './filterTypes'
import type { NormalizedParams } from './paramNormalize'

export interface SortedGridSlot extends GridSlot {
  readonly columnIndex: number
  readonly rowIndex: number
}

export interface ColumnDescriptor {
  /** JSON.stringify-comparable label for the axis overlay */
  readonly paramValue: string
  readonly columnIndex: number
  readonly worldX: number
}

export interface RowDescriptor {
  /** JSON.stringify-comparable label for the axis overlay */
  readonly paramValue: string
  readonly rowIndex: number
  /** row-band start worldY — reflects accumulated row-band offset, NOT naïve r * gridSpacing */
  readonly worldY: number
}

export const SORTABLE_PARAM_KEYS: readonly ParamKey[] = [
  'model',
  'loras',
  'cfg',
  'steps',
  'sampler',
  'scheduler',
  'seed',
  'width',
  'height',
  'timestamp'
]

export function isSortableParamKey(key: ParamKey): boolean {
  return (SORTABLE_PARAM_KEYS as readonly string[]).includes(key)
}

/**
 * Extract the sort value for a given ParamKey.
 * Returns `undefined` for params that lack a value or are not sortable.
 * For 'loras', returns the count (D-04 — sort by LoRA count, always defined).
 * Non-finite numbers are treated as undefined (threat mitigation T-03-03-02).
 */
function extractSortValue(
  params: NormalizedParams,
  key: ParamKey
): number | string | undefined {
  switch (key) {
    case 'loras':
      // D-04: sort by loras.length — count is always defined (even 0 is valid)
      return params.loras.length
    case 'cfg': {
      const v = params.cfg
      return v !== undefined && Number.isFinite(v) ? v : undefined
    }
    case 'steps': {
      const v = params.steps
      return v !== undefined && Number.isFinite(v) ? v : undefined
    }
    case 'seed': {
      const v = params.seed
      return v !== undefined && Number.isFinite(v) ? v : undefined
    }
    case 'width': {
      const v = params.width
      return v !== undefined && Number.isFinite(v) ? v : undefined
    }
    case 'height': {
      const v = params.height
      return v !== undefined && Number.isFinite(v) ? v : undefined
    }
    case 'timestamp': {
      const v = params.timestamp
      return Number.isFinite(v) ? v : undefined
    }
    case 'model':
      return params.model
    case 'sampler':
      return params.sampler
    case 'scheduler':
      return params.scheduler
    case 'positivePrompt':
    case 'negativePrompt':
    case 'favourite':
    case 'tags':
    case 'resolution':
      // These param keys are not in SORTABLE_PARAM_KEYS
      return undefined
  }
}

/**
 * Compare two serialized group key strings for column ordering.
 * If both keys parse as finite numbers, sort numerically.
 * Otherwise sort alphabetically (string comparison).
 */
function compareGroupKeys(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * computeSortedLayout1D (SORT-01, SORT-03, SORT-04, SORT-05).
 *
 * Groups visible hashes by the serialized value of `sortX`, then assigns one
 * column per unique value. Within each column, assets stack vertically in
 * deterministic hash order (sorted by content hash). Every worldX and worldY
 * is an exact integer multiple of `gridSpacing`.
 *
 * Assets with no value for `sortX` are excluded (SORT-03).
 * Numeric values sort numerically; categorical (string) values sort
 * alphabetically (D-16).
 */
export function computeSortedLayout1D(
  visibleHashes: readonly string[],
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  sortX: ParamKey,
  gridSpacing: number
): {
  readonly slots: readonly SortedGridSlot[]
  readonly columns: readonly ColumnDescriptor[]
} {
  const groups = new Map<string, string[]>()

  for (const hash of visibleHashes) {
    const p = paramsByHash.get(hash)
    if (!p) continue
    const v = extractSortValue(p, sortX)
    if (v === undefined) continue // SORT-03: exclude missing param
    const key = String(v)
    const bucket = groups.get(key)
    if (bucket) {
      bucket.push(hash)
    } else {
      groups.set(key, [hash])
    }
  }

  const sortedKeys = [...groups.keys()].sort(compareGroupKeys)
  const slots: SortedGridSlot[] = []
  const columns: ColumnDescriptor[] = []

  for (let colIdx = 0; colIdx < sortedKeys.length; colIdx++) {
    const key = sortedKeys[colIdx]
    // Sort hashes within column for deterministic row order
    const bucket = [...(groups.get(key) ?? [])].sort()
    const worldX = colIdx * gridSpacing
    columns.push({ paramValue: key, columnIndex: colIdx, worldX })
    for (let rowIdx = 0; rowIdx < bucket.length; rowIdx++) {
      slots.push({
        hash: bucket[rowIdx],
        worldX,
        worldY: rowIdx * gridSpacing, // exact multiple — SORT-05 literal
        columnIndex: colIdx,
        rowIndex: rowIdx
      })
    }
  }

  return { slots, columns }
}

/**
 * computeSortedLayout2D (SORT-02, SORT-03, SORT-04, SORT-05).
 *
 * Groups visible hashes by (sortX value, sortY value). Assets lacking either
 * axis value are excluded (SORT-03). Within each cell, multiple assets stack
 * vertically using ROW-BAND ACCUMULATION:
 *
 *   For each row r, yStackSize[r] = max count of assets in any cell of row r.
 *   rowStart[r] = gridSpacing × sum(yStackSize[0..r-1]).
 *   Asset k in cell (r, c) → worldY = rowStart[r] + k × gridSpacing.
 *
 * This guarantees every worldY is an exact integer multiple of gridSpacing
 * (SORT-05 literal) with no overlap between rows even when cells stack.
 *
 * The `rows[r].worldY` field reflects the accumulated rowStart offset — NOT
 * the naïve `r × gridSpacing`. Axis-overlay consumers must use `rows[r].worldY`
 * directly.
 */
export function computeSortedLayout2D(
  visibleHashes: readonly string[],
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  sortX: ParamKey,
  sortY: ParamKey,
  gridSpacing: number
): {
  readonly slots: readonly SortedGridSlot[]
  readonly columns: readonly ColumnDescriptor[]
  readonly rows: readonly RowDescriptor[]
} {
  // Bucket hashes by (xKey, yKey).
  // cellBuckets: xKey → (yKey → hashes[])
  const cellBuckets = new Map<string, Map<string, string[]>>()
  const xKeys = new Set<string>()
  const yKeys = new Set<string>()

  for (const hash of visibleHashes) {
    const p = paramsByHash.get(hash)
    if (!p) continue
    const xv = extractSortValue(p, sortX)
    const yv = extractSortValue(p, sortY)
    if (xv === undefined || yv === undefined) continue // SORT-03 on either axis
    const xKey = String(xv)
    const yKey = String(yv)
    xKeys.add(xKey)
    yKeys.add(yKey)
    let xMap = cellBuckets.get(xKey)
    if (!xMap) {
      xMap = new Map()
      cellBuckets.set(xKey, xMap)
    }
    const cellHashes = xMap.get(yKey)
    if (cellHashes) {
      cellHashes.push(hash)
    } else {
      xMap.set(yKey, [hash])
    }
  }

  const sortedX = [...xKeys].sort(compareGroupKeys)
  const sortedY = [...yKeys].sort(compareGroupKeys)
  const xIndexOf = new Map(sortedX.map((k, i) => [k, i]))
  const yIndexOf = new Map(sortedY.map((k, i) => [k, i]))

  // Row-band accumulation (RESEARCH §Pattern 4):
  // yStackSize[r] = max cell-count across all x for row r
  const yStackSize: number[] = sortedY.map(() => 0)
  for (const [, xMap] of cellBuckets) {
    for (const [yKey, hashes] of xMap) {
      const r = yIndexOf.get(yKey)
      if (r === undefined) continue
      if (hashes.length > yStackSize[r]) yStackSize[r] = hashes.length
    }
  }
  // Every row reserves at least 1 slot of vertical space so row descriptors
  // are spaced consistently even when empty of assets (should not occur in
  // practice since yKeys is derived from actual assets, but guard anyway).
  for (let i = 0; i < yStackSize.length; i++) {
    if (yStackSize[i] === 0) yStackSize[i] = 1
  }

  // Accumulate rowStart offsets (in grid units, then multiply by gridSpacing)
  const rowStart: number[] = []
  let acc = 0
  for (let i = 0; i < sortedY.length; i++) {
    rowStart.push(acc * gridSpacing)
    acc += yStackSize[i]
  }

  const columns: ColumnDescriptor[] = sortedX.map((k, i) => ({
    paramValue: k,
    columnIndex: i,
    worldX: i * gridSpacing
  }))
  const rows: RowDescriptor[] = sortedY.map((k, i) => ({
    paramValue: k,
    rowIndex: i,
    worldY: rowStart[i] // accumulated offset — not naïve i * gridSpacing
  }))

  const slots: SortedGridSlot[] = []
  for (const [xKey, xMap] of cellBuckets) {
    const colIdx = xIndexOf.get(xKey)
    if (colIdx === undefined) continue
    for (const [yKey, hashes] of xMap) {
      const rowIdx = yIndexOf.get(yKey)
      if (rowIdx === undefined) continue
      // Sort hashes within cell for deterministic stacking order
      const sortedHashes = [...hashes].sort()
      const baseX = colIdx * gridSpacing
      const baseY = rowStart[rowIdx]
      // Row-band accumulation: each stacked asset gets an exact gridSpacing
      // step. Row rowIdx+1 starts at baseY + yStackSize[rowIdx] * gridSpacing
      // so stacked assets never overlap with the next row.
      for (let k = 0; k < sortedHashes.length; k++) {
        slots.push({
          hash: sortedHashes[k],
          worldX: baseX,
          worldY: baseY + k * gridSpacing, // exact multiple of gridSpacing — SORT-05 literal
          columnIndex: colIdx,
          rowIndex: rowIdx
        })
      }
    }
  }

  return { slots, columns, rows }
}
