import { describe, expect, it } from 'vitest'

import {
  SORTABLE_PARAM_KEYS,
  computeSortedLayout1D,
  computeSortedLayout2D,
  isSortableParamKey
} from './sortMath'
import type { NormalizedParams } from './paramNormalize'

function makeParams(overrides: Partial<NormalizedParams>): NormalizedParams {
  return {
    model: undefined,
    loras: [],
    cfg: undefined,
    steps: undefined,
    sampler: undefined,
    scheduler: undefined,
    seed: undefined,
    positivePrompt: undefined,
    negativePrompt: undefined,
    width: undefined,
    height: undefined,
    timestamp: 0,
    workflowFingerprint: '',
    workflowFilename: null,
    ...overrides
  }
}

function paramsMap(
  entries: Record<string, Partial<NormalizedParams>>
): Map<string, NormalizedParams> {
  return new Map(
    Object.entries(entries).map(([k, v]) => [k, makeParams(v)])
  )
}

// ---------------------------------------------------------------------------
// isSortableParamKey / SORTABLE_PARAM_KEYS
// ---------------------------------------------------------------------------

describe('isSortableParamKey / SORTABLE_PARAM_KEYS', () => {
  it('returns true for all entries in SORTABLE_PARAM_KEYS', () => {
    for (const key of SORTABLE_PARAM_KEYS) {
      expect(isSortableParamKey(key)).toBe(true)
    }
  })

  it('returns false for non-sortable keys', () => {
    expect(isSortableParamKey('positivePrompt')).toBe(false)
    expect(isSortableParamKey('negativePrompt')).toBe(false)
    expect(isSortableParamKey('tags')).toBe(false)
    expect(isSortableParamKey('favourite')).toBe(false)
    expect(isSortableParamKey('resolution')).toBe(false)
  })

  it('SORTABLE_PARAM_KEYS contains exactly 10 entries', () => {
    expect(SORTABLE_PARAM_KEYS).toHaveLength(10)
  })

  it('SORTABLE_PARAM_KEYS contains the expected keys', () => {
    expect(SORTABLE_PARAM_KEYS).toContain('model')
    expect(SORTABLE_PARAM_KEYS).toContain('loras')
    expect(SORTABLE_PARAM_KEYS).toContain('cfg')
    expect(SORTABLE_PARAM_KEYS).toContain('steps')
    expect(SORTABLE_PARAM_KEYS).toContain('sampler')
    expect(SORTABLE_PARAM_KEYS).toContain('scheduler')
    expect(SORTABLE_PARAM_KEYS).toContain('seed')
    expect(SORTABLE_PARAM_KEYS).toContain('width')
    expect(SORTABLE_PARAM_KEYS).toContain('height')
    expect(SORTABLE_PARAM_KEYS).toContain('timestamp')
  })
})

// ---------------------------------------------------------------------------
// computeSortedLayout1D
// ---------------------------------------------------------------------------

describe('computeSortedLayout1D', () => {
  describe('column bucketing (D-16, SORT-01)', () => {
    it('produces one column per unique CFG value', () => {
      const hashes = ['a', 'b', 'c', 'd']
      const params = paramsMap({
        a: { cfg: 6 },
        b: { cfg: 7 },
        c: { cfg: 7 },
        d: { cfg: 8 }
      })
      const { slots, columns } = computeSortedLayout1D(hashes, params, 'cfg', 100)
      expect(columns).toHaveLength(3) // 6, 7, 8
      expect(slots).toHaveLength(4)
    })

    it('returns column descriptors in sorted order matching columnIndex', () => {
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { cfg: 10 },
        b: { cfg: 2 },
        c: { cfg: 7 }
      })
      const { columns } = computeSortedLayout1D(hashes, params, 'cfg', 100)
      // columns should be ordered: [2, 7, 10]
      expect(columns.map((c) => c.paramValue)).toEqual(['2', '7', '10'])
      expect(columns.map((c) => c.columnIndex)).toEqual([0, 1, 2])
    })

    it('stacks assets within the same column with increasing rowIndex', () => {
      const hashes = ['a', 'b']
      const params = paramsMap({
        a: { cfg: 7 },
        b: { cfg: 7 }
      })
      const { slots } = computeSortedLayout1D(hashes, params, 'cfg', 100)
      expect(slots).toHaveLength(2)
      const rowIndices = slots.map((s) => s.rowIndex).sort()
      expect(rowIndices).toEqual([0, 1])
    })
  })

  describe('numeric-value ordering (SORT-01)', () => {
    it('sorts CFG values numerically, not alphabetically', () => {
      // Alphabetic order of [10, 2, 7] would be: 10, 2, 7
      // Numeric order should be: 2, 7, 10
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { cfg: 10 },
        b: { cfg: 2 },
        c: { cfg: 7 }
      })
      const { columns } = computeSortedLayout1D(hashes, params, 'cfg', 100)
      expect(columns[0].paramValue).toBe('2')
      expect(columns[1].paramValue).toBe('7')
      expect(columns[2].paramValue).toBe('10')
      // Column indices reflect numeric sort
      expect(columns[0].columnIndex).toBe(0)
      expect(columns[1].columnIndex).toBe(1)
      expect(columns[2].columnIndex).toBe(2)
    })
  })

  describe('categorical-value ordering (alphabetic) (SORT-01)', () => {
    it('sorts sampler values alphabetically', () => {
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { sampler: 'euler_a' },
        b: { sampler: 'dpmpp_2m' },
        c: { sampler: 'euler' }
      })
      const { columns } = computeSortedLayout1D(hashes, params, 'sampler', 100)
      expect(columns.map((c) => c.paramValue)).toEqual([
        'dpmpp_2m',
        'euler',
        'euler_a'
      ])
    })
  })

  describe('missing param exclusion (SORT-03)', () => {
    it('excludes assets with undefined param from slots', () => {
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { cfg: 7 },
        b: { cfg: undefined }, // missing
        c: { cfg: 8 }
      })
      const { slots, columns } = computeSortedLayout1D(
        hashes,
        params,
        'cfg',
        100
      )
      expect(slots).toHaveLength(2)
      expect(columns).toHaveLength(2) // only 7 and 8
      const presentHashes = slots.map((s) => s.hash)
      expect(presentHashes).not.toContain('b')
    })
  })

  describe('grid-snap positioning (SORT-04, SORT-05)', () => {
    it('column worldX equals columnIndex * gridSpacing (SORT-05 literal)', () => {
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { cfg: 6 },
        b: { cfg: 7 },
        c: { cfg: 8 }
      })
      const gridSpacing = 200
      const { columns, slots } = computeSortedLayout1D(
        hashes,
        params,
        'cfg',
        gridSpacing
      )
      expect(columns[0].worldX).toBe(0)
      expect(columns[1].worldX).toBe(200)
      expect(columns[2].worldX).toBe(400)
      // All slot worldX values are exact multiples of gridSpacing
      for (const slot of slots) {
        expect(slot.worldX % gridSpacing).toBe(0)
      }
    })

    it('column 1 worldX equals 560 when gridSpacing = 560 (Phase 2 default)', () => {
      const hashes = ['a', 'b']
      const params = paramsMap({
        a: { cfg: 6 },
        b: { cfg: 7 }
      })
      const { columns } = computeSortedLayout1D(hashes, params, 'cfg', 560)
      expect(columns[1].worldX).toBe(560)
    })

    it('row 0 worldY = 0, row 1 worldY = gridSpacing, row 2 worldY = 2 * gridSpacing (SORT-05 literal)', () => {
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { cfg: 7 },
        b: { cfg: 7 },
        c: { cfg: 7 }
      })
      const gridSpacing = 100
      const { slots } = computeSortedLayout1D(hashes, params, 'cfg', gridSpacing)
      const sortedByRow = [...slots].sort((x, y) => x.rowIndex - y.rowIndex)
      expect(sortedByRow[0].worldY).toBe(0)
      expect(sortedByRow[1].worldY).toBe(100)
      expect(sortedByRow[2].worldY).toBe(200)
    })

    it('all slot worldY values are exact multiples of gridSpacing (SORT-05 literal)', () => {
      const hashes = ['a', 'b', 'c', 'd']
      const params = paramsMap({
        a: { cfg: 7 },
        b: { cfg: 7 },
        c: { cfg: 8 },
        d: { cfg: 8 }
      })
      const gridSpacing = 150
      const { slots } = computeSortedLayout1D(hashes, params, 'cfg', gridSpacing)
      for (const slot of slots) {
        expect(slot.worldY % gridSpacing).toBe(0)
      }
    })
  })

  describe('row order within a column is deterministic', () => {
    it('rows within the same column are sorted by content hash', () => {
      // 'apple' < 'banana' < 'cherry' lexicographically
      const hashes = ['cherry', 'apple', 'banana']
      const params = paramsMap({
        cherry: { cfg: 7 },
        apple: { cfg: 7 },
        banana: { cfg: 7 }
      })
      const { slots } = computeSortedLayout1D(hashes, params, 'cfg', 100)
      const sortedByRow = [...slots].sort((a, b) => a.rowIndex - b.rowIndex)
      expect(sortedByRow[0].hash).toBe('apple')
      expect(sortedByRow[1].hash).toBe('banana')
      expect(sortedByRow[2].hash).toBe('cherry')
    })
  })

  describe('loras-count bucketing (D-04)', () => {
    it('sorts by loras.length — 2 LoRAs and 3 LoRAs go in different columns', () => {
      const hashes = ['a', 'b']
      const params = paramsMap({
        a: {
          loras: [
            { name: 'lora1', weight: 1 },
            { name: 'lora2', weight: 1 }
          ]
        },
        b: {
          loras: [
            { name: 'lora1', weight: 1 },
            { name: 'lora2', weight: 1 },
            { name: 'lora3', weight: 1 }
          ]
        }
      })
      const { columns } = computeSortedLayout1D(hashes, params, 'loras', 100)
      expect(columns).toHaveLength(2)
    })

    it('asset with 0 LoRAs is NOT excluded (count is always defined)', () => {
      const hashes = ['a', 'b']
      const params = paramsMap({
        a: { loras: [] },
        b: { loras: [{ name: 'lora1', weight: 1 }] }
      })
      const { slots } = computeSortedLayout1D(hashes, params, 'loras', 100)
      // Both assets should appear — 0 LoRAs is a valid count
      expect(slots).toHaveLength(2)
    })
  })

  describe('empty input', () => {
    it('returns empty slots and columns for empty hash list', () => {
      const { slots, columns } = computeSortedLayout1D(
        [],
        new Map(),
        'cfg',
        100
      )
      expect(slots).toHaveLength(0)
      expect(columns).toHaveLength(0)
    })

    it('gridSpacing = 0 collapses all positions to 0', () => {
      const hashes = ['a', 'b']
      const params = paramsMap({
        a: { cfg: 7 },
        b: { cfg: 8 }
      })
      const { slots, columns } = computeSortedLayout1D(hashes, params, 'cfg', 0)
      for (const slot of slots) {
        expect(slot.worldX).toBe(0)
        expect(slot.worldY).toBe(0)
      }
      for (const col of columns) {
        expect(col.worldX).toBe(0)
      }
    })
  })
})

// ---------------------------------------------------------------------------
// computeSortedLayout2D
// ---------------------------------------------------------------------------

describe('computeSortedLayout2D', () => {
  describe('X × Y bucketing (SORT-02)', () => {
    it('produces a 2×2 grid for 4 assets across cfg × sampler', () => {
      const hashes = ['a', 'b', 'c', 'd']
      const params = paramsMap({
        a: { cfg: 7, sampler: 'euler' },
        b: { cfg: 8, sampler: 'euler' },
        c: { cfg: 7, sampler: 'dpmpp' },
        d: { cfg: 8, sampler: 'dpmpp' }
      })
      const { slots, columns, rows } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        100
      )
      expect(slots).toHaveLength(4)
      expect(columns).toHaveLength(2) // cfg: 7, 8
      expect(rows).toHaveLength(2) // sampler: dpmpp, euler (alphabetic)
    })

    it('each cell has exactly one asset per unique (X,Y) pair', () => {
      const hashes = ['a', 'b', 'c', 'd']
      const params = paramsMap({
        a: { cfg: 7, sampler: 'euler' },
        b: { cfg: 8, sampler: 'euler' },
        c: { cfg: 7, sampler: 'dpmpp' },
        d: { cfg: 8, sampler: 'dpmpp' }
      })
      const { slots } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        100
      )
      // Each asset has a unique worldX, worldY combination
      const positions = slots.map((s) => `${s.worldX},${s.worldY}`)
      const unique = new Set(positions)
      expect(unique.size).toBe(4)
    })

    it('columns descriptor length equals unique X values', () => {
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { cfg: 6, sampler: 'euler' },
        b: { cfg: 7, sampler: 'euler' },
        c: { cfg: 8, sampler: 'euler' }
      })
      const { columns } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        100
      )
      expect(columns).toHaveLength(3)
    })

    it('rows descriptor length equals unique Y values', () => {
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { cfg: 7, sampler: 'euler' },
        b: { cfg: 7, sampler: 'dpmpp' },
        c: { cfg: 7, sampler: 'euler_a' }
      })
      const { rows } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        100
      )
      expect(rows).toHaveLength(3)
    })
  })

  describe('exclusion: missing either axis (SORT-03)', () => {
    it('excludes asset missing sortX', () => {
      const hashes = ['a', 'b']
      const params = paramsMap({
        a: { cfg: 7, sampler: 'euler' },
        b: { cfg: undefined, sampler: 'euler' } // missing X
      })
      const { slots } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        100
      )
      expect(slots).toHaveLength(1)
      expect(slots[0].hash).toBe('a')
    })

    it('excludes asset missing sortY', () => {
      const hashes = ['a', 'b']
      const params = paramsMap({
        a: { cfg: 7, sampler: 'euler' },
        b: { cfg: 7, sampler: undefined } // missing Y
      })
      const { slots } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        100
      )
      expect(slots).toHaveLength(1)
      expect(slots[0].hash).toBe('a')
    })
  })

  describe('row-band accumulation stacking (RESEARCH §Pattern 4)', () => {
    it('stacks assets in a cell using exact gridSpacing multiples (SORT-05 literal)', () => {
      // Test case A: row 0 has one cell with 2 assets
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { cfg: 7, sampler: 'euler' },
        b: { cfg: 7, sampler: 'euler' }, // stacked in same cell as 'a'
        c: { cfg: 7, sampler: 'dpmpp' } // row 1, 1 asset
      })
      const gridSpacing = 100
      const { slots } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        gridSpacing
      )
      // Row 0 (dpmpp alphabetically first) has 1 asset
      // Row 1 (euler) has 2 assets stacked
      // yStackSize[0] = 1 (row: dpmpp)
      // yStackSize[1] = 2 (row: euler)
      // rowStart[0] = 0
      // rowStart[1] = 1 * gridSpacing = 100
      // euler stack: worldY = 100, worldY = 200
      const eulerSlots = slots
        .filter((s) => s.hash === 'a' || s.hash === 'b')
        .sort((x, y) => x.worldY - y.worldY)
      expect(eulerSlots[0].worldY % gridSpacing).toBe(0)
      expect(eulerSlots[1].worldY % gridSpacing).toBe(0)
      // They must differ by exactly gridSpacing
      expect(eulerSlots[1].worldY - eulerSlots[0].worldY).toBe(gridSpacing)
    })

    it('reserves yStackSize[r] rows of vertical space per row r (test case B)', () => {
      // Three assets in cell (0,0), two assets in cell (1,0), gridSpacing=100
      // Row 0 (dpmpp) reserves yStackSize[0] = 3 → 300 units
      // Row 1 (euler) assets land at worldY = 300 and worldY = 400
      const hashes = ['a', 'b', 'c', 'd', 'e']
      const params = paramsMap({
        a: { cfg: 7, sampler: 'dpmpp' },
        b: { cfg: 7, sampler: 'dpmpp' },
        c: { cfg: 7, sampler: 'dpmpp' },
        d: { cfg: 7, sampler: 'euler' },
        e: { cfg: 7, sampler: 'euler' }
      })
      const gridSpacing = 100
      const { slots } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        gridSpacing
      )
      // All worldY must be exact multiples of gridSpacing (SORT-05 literal)
      for (const slot of slots) {
        expect(slot.worldY % gridSpacing).toBe(0)
      }
      const eulerSlots = slots
        .filter((s) => s.hash === 'd' || s.hash === 'e')
        .map((s) => s.worldY)
        .sort((x, y) => x - y)
      // Row 0 (dpmpp) takes 3 × 100 = 300 units, so euler starts at 300
      expect(eulerSlots[0]).toBe(300)
      expect(eulerSlots[1]).toBe(400)
    })

    it('single-asset-per-cell degenerates to naïve r * gridSpacing', () => {
      // Test case C: all yStackSize[r] = 1 → rowStart[r] = r * gridSpacing
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { cfg: 7, sampler: 'euler' },
        b: { cfg: 7, sampler: 'dpmpp' },
        c: { cfg: 7, sampler: 'euler_a' }
      })
      const gridSpacing = 100
      const { rows } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        gridSpacing
      )
      // Alphabetic order: dpmpp=0, euler=1, euler_a=2
      // All rows have 1 asset, so rowStart[r] = r * gridSpacing
      expect(rows[0].worldY).toBe(0)
      expect(rows[1].worldY).toBe(100)
      expect(rows[2].worldY).toBe(200)
    })
  })

  describe('grid-snap (SORT-04, SORT-05) — every worldY is an exact multiple of gridSpacing', () => {
    it('2D: slots.every(s => s.worldY % gridSpacing === 0) is true for test case B', () => {
      const hashes = ['a', 'b', 'c', 'd', 'e']
      const params = paramsMap({
        a: { cfg: 7, sampler: 'dpmpp' },
        b: { cfg: 7, sampler: 'dpmpp' },
        c: { cfg: 7, sampler: 'dpmpp' },
        d: { cfg: 7, sampler: 'euler' },
        e: { cfg: 7, sampler: 'euler' }
      })
      const gridSpacing = 100
      const { slots } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        gridSpacing
      )
      expect(slots.every((s) => s.worldY % gridSpacing === 0)).toBe(true)
    })

    it('2D: slots.every(s => s.worldX % gridSpacing === 0) is true', () => {
      const hashes = ['a', 'b', 'c', 'd']
      const params = paramsMap({
        a: { cfg: 6, sampler: 'euler' },
        b: { cfg: 7, sampler: 'euler' },
        c: { cfg: 6, sampler: 'dpmpp' },
        d: { cfg: 7, sampler: 'dpmpp' }
      })
      const gridSpacing = 150
      const { slots } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        gridSpacing
      )
      expect(slots.every((s) => s.worldX % gridSpacing === 0)).toBe(true)
    })
  })

  describe('row descriptors', () => {
    it('rows[r].worldY reflects accumulated row-band offset not naïve r * gridSpacing', () => {
      // Row 0 (dpmpp) has 2 assets stacked, so it reserves 2 * gridSpacing
      // Row 1 (euler) worldY = 2 * gridSpacing = 200
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { cfg: 7, sampler: 'dpmpp' },
        b: { cfg: 7, sampler: 'dpmpp' }, // 2nd asset in row 0 cell
        c: { cfg: 7, sampler: 'euler' }
      })
      const gridSpacing = 100
      const { rows } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        gridSpacing
      )
      // dpmpp < euler alphabetically
      expect(rows[0].paramValue).toBe('dpmpp')
      expect(rows[0].worldY).toBe(0)
      expect(rows[1].paramValue).toBe('euler')
      expect(rows[1].worldY).toBe(200) // not 100! row-band accumulation
    })

    it('single-value sortY still produces 1 row with rowStart = 0', () => {
      const hashes = ['a', 'b', 'c']
      const params = paramsMap({
        a: { cfg: 6, sampler: 'euler' },
        b: { cfg: 7, sampler: 'euler' },
        c: { cfg: 8, sampler: 'euler' }
      })
      const { rows } = computeSortedLayout2D(
        hashes,
        params,
        'cfg',
        'sampler',
        100
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].worldY).toBe(0)
    })
  })

  describe('empty input', () => {
    it('returns empty slots, columns, and rows for empty hash list', () => {
      const { slots, columns, rows } = computeSortedLayout2D(
        [],
        new Map(),
        'cfg',
        'sampler',
        100
      )
      expect(slots).toHaveLength(0)
      expect(columns).toHaveLength(0)
      expect(rows).toHaveLength(0)
    })
  })
})
