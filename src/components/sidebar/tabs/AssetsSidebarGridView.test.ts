import { describe, expect, it } from 'vitest'

import {
  GAP_PX,
  GRID_COLUMN_RANGES,
  computeColumns
} from './AssetsSidebarGridView.vue'

describe('computeColumns', () => {
  it('returns 1 column when width is 0', () => {
    expect(computeColumns(0, 100, 200, GAP_PX)).toBe(1)
  })

  it('returns 1 column when width is negative', () => {
    expect(computeColumns(-100, 100, 200, GAP_PX)).toBe(1)
  })

  it('collapses to 1 column when panel is narrower than min', () => {
    const min = 100
    const max = 200
    // Width below min: single column that's smaller than min
    const width = min - 20
    expect(computeColumns(width, min, max, GAP_PX)).toBe(1)
  })

  it('packs 2 columns when panel is slightly wider than max', () => {
    const min = 100
    const max = 200
    // Width slightly more than max (one column fits but cell would exceed max)
    const width = max + 20
    const cols = computeColumns(width, min, max, GAP_PX)
    expect(cols).toBe(2)
    const cellWidth = (width - GAP_PX * (cols - 1)) / cols
    expect(cellWidth).toBeGreaterThanOrEqual(min)
    expect(cellWidth).toBeLessThanOrEqual(max)
  })

  it('packs max columns for wide panel with each cell within bounds', () => {
    const min = 144
    const max = 220
    const width = 1200
    const cols = computeColumns(width, min, max, GAP_PX)
    const cellWidth = (width - GAP_PX * (cols - 1)) / cols
    expect(cellWidth).toBeGreaterThanOrEqual(min)
    expect(cellWidth).toBeLessThanOrEqual(max)
    // Confirm packing is greedy: adding one more column would drop below min
    const nextCellWidth = (width - GAP_PX * cols) / (cols + 1)
    expect(nextCellWidth).toBeLessThan(min)
  })

  it('keeps cell width at or below max for extremely wide panels', () => {
    const min = 96
    const max = 140
    const width = 4000
    const cols = computeColumns(width, min, max, GAP_PX)
    const cellWidth = (width - GAP_PX * (cols - 1)) / cols
    expect(cellWidth).toBeLessThanOrEqual(max)
  })

  it('handles sm preset at typical sidebar widths', () => {
    const { min, max } = GRID_COLUMN_RANGES.sm
    const cols = computeColumns(400, min, max, GAP_PX)
    expect(cols).toBeGreaterThanOrEqual(2)
    const cellWidth = (400 - GAP_PX * (cols - 1)) / cols
    expect(cellWidth).toBeLessThanOrEqual(max)
  })

  it('sm always produces more columns than md at typical sidebar widths', () => {
    const sm = GRID_COLUMN_RANGES.sm
    const md = GRID_COLUMN_RANGES.md
    for (const width of [220, 270, 320, 370, 420]) {
      const smCols = computeColumns(width, sm.min, sm.max, GAP_PX)
      const mdCols = computeColumns(width, md.min, md.max, GAP_PX)
      expect(smCols).toBeGreaterThan(mdCols)
    }
  })

  it('handles md preset at typical sidebar widths', () => {
    const { min, max } = GRID_COLUMN_RANGES.md
    const cols = computeColumns(600, min, max, GAP_PX)
    const cellWidth = (600 - GAP_PX * (cols - 1)) / cols
    expect(cellWidth).toBeGreaterThanOrEqual(min)
    expect(cellWidth).toBeLessThanOrEqual(max)
  })

  it('handles lg preset at typical sidebar widths', () => {
    const { min, max } = GRID_COLUMN_RANGES.lg
    const cols = computeColumns(800, min, max, GAP_PX)
    const cellWidth = (800 - GAP_PX * (cols - 1)) / cols
    expect(cellWidth).toBeGreaterThanOrEqual(min)
    expect(cellWidth).toBeLessThanOrEqual(max)
  })
})
