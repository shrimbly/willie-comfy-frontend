import { describe, expect, it } from 'vitest'

import { computeIntersectedIndices } from './useMarqueeSelection'

const defaultLayout = {
  cols: 3,
  itemWidth: 100,
  itemHeight: 120,
  headerHeight: 0,
  gap: 8,
  padLeft: 8
}

describe('computeIntersectedIndices', () => {
  it('returns empty for 0 items', () => {
    const result = computeIntersectedIndices(
      { left: 0, top: 0, right: 200, bottom: 200 },
      defaultLayout,
      0
    )
    expect(result).toEqual([])
  })

  it('returns empty for 0 cols', () => {
    const result = computeIntersectedIndices(
      { left: 0, top: 0, right: 200, bottom: 200 },
      { ...defaultLayout, cols: 0 },
      10
    )
    expect(result).toEqual([])
  })

  it('hits a single cell', () => {
    // First cell spans x: [8, 108], y: [0, 120]
    const result = computeIntersectedIndices(
      { left: 10, top: 10, right: 50, bottom: 50 },
      defaultLayout,
      9
    )
    expect(result).toEqual([0])
  })

  it('hits the second cell in first row', () => {
    // Second cell starts at x: 8 + 1*(100+8) = 116, ends at 216
    const result = computeIntersectedIndices(
      { left: 120, top: 10, right: 200, bottom: 50 },
      defaultLayout,
      9
    )
    expect(result).toEqual([1])
  })

  it('hits multiple cells across rows', () => {
    // Cover top-left 2x2 area
    // Row 0: x [8,108] and [116,216], y [0,120]
    // Row 1: x [8,108] and [116,216], y [128,248]
    const result = computeIntersectedIndices(
      { left: 0, top: 0, right: 220, bottom: 250 },
      defaultLayout,
      9
    )
    expect(result).toEqual([0, 1, 3, 4])
  })

  it('does not include items beyond totalItems', () => {
    const result = computeIntersectedIndices(
      { left: 0, top: 0, right: 500, bottom: 500 },
      defaultLayout,
      5
    )
    // Only indices 0-4 exist (2 rows: [0,1,2], [3,4])
    expect(result).toEqual([0, 1, 2, 3, 4])
  })

  it('returns empty when rect is outside grid area (right of grid)', () => {
    // 3 cols with itemWidth=100, gap=8, padLeft=8
    // Last cell right edge: 8 + 2*(108) + 100 = 324
    const result = computeIntersectedIndices(
      { left: 400, top: 0, right: 500, bottom: 200 },
      defaultLayout,
      9
    )
    expect(result).toEqual([])
  })

  it('returns empty when rect is outside grid area (below grid)', () => {
    // 3 items, 1 row. Row height = 120. Last row bottom = 120.
    const result = computeIntersectedIndices(
      { left: 0, top: 200, right: 200, bottom: 300 },
      defaultLayout,
      3
    )
    expect(result).toEqual([])
  })

  it('excludes gap-only intersections', () => {
    // Gap between col 0 and col 1: x [108, 116]
    const result = computeIntersectedIndices(
      { left: 109, top: 10, right: 115, bottom: 50 },
      defaultLayout,
      9
    )
    expect(result).toEqual([])
  })

  it('works with a single column layout', () => {
    const layout = { ...defaultLayout, cols: 1 }
    const result = computeIntersectedIndices(
      { left: 0, top: 0, right: 200, bottom: 300 },
      layout,
      5
    )
    // cellH = 128, so row 0: [0,120], row 1: [128,248], row 2: top=256
    // rect bottom 300 > 256+120=376, so row 2 is hit
    expect(result).toEqual([0, 1, 2])
  })

  it('accounts for headerHeight offset', () => {
    const layout = { ...defaultLayout, headerHeight: 50 }
    // With headerHeight=50, first row starts at y=50
    // Cell 0: y [50, 170]
    // A rect at y [0, 40] is above the grid
    const above = computeIntersectedIndices(
      { left: 0, top: 0, right: 200, bottom: 40 },
      layout,
      9
    )
    expect(above).toEqual([])

    // A rect overlapping the first row
    const hit = computeIntersectedIndices(
      { left: 0, top: 60, right: 200, bottom: 100 },
      layout,
      9
    )
    expect(hit).toEqual([0, 1])
  })

  it('handles partial overlap at cell edges', () => {
    // First cell: x [8, 108], y [0, 120]
    // Rect that just barely overlaps the right edge
    const result = computeIntersectedIndices(
      { left: 107, top: 0, right: 109, bottom: 10 },
      defaultLayout,
      9
    )
    expect(result).toEqual([0])
  })
})
