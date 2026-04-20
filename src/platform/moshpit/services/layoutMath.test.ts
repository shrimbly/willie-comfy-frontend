import { describe, expect, it } from 'vitest'

describe('layoutMath (Wave 1)', () => {
  it('computeSquareGridDimensions returns ceil(sqrt(N)) cols and rows', async () => {
    const { computeSquareGridDimensions } = await import('./layoutMath')
    expect(computeSquareGridDimensions(0)).toEqual({ cols: 0, rows: 0 })
    expect(computeSquareGridDimensions(1)).toEqual({ cols: 1, rows: 1 })
    expect(computeSquareGridDimensions(10)).toEqual({ cols: 4, rows: 3 })
    expect(computeSquareGridDimensions(16)).toEqual({ cols: 4, rows: 4 })
    expect(computeSquareGridDimensions(17)).toEqual({ cols: 5, rows: 4 })
  })

  it('computeJitteredGrid returns N slots with jitter bounded by cellSize/2', async () => {
    const { computeJitteredGrid } = await import('./layoutMath')
    const hashes = ['a', 'b', 'c', 'd', 'e']
    const cellSize = 560
    const slots = computeJitteredGrid(hashes, 12345, cellSize)
    expect(slots).toHaveLength(5)
    for (const [i, slot] of slots.entries()) {
      expect(slot.hash).toBe(hashes[i])
      // jitter must not exceed cellSize/2
      const col = i % Math.ceil(Math.sqrt(5))
      const row = Math.floor(i / Math.ceil(Math.sqrt(5)))
      expect(Math.abs(slot.worldX - col * cellSize)).toBeLessThan(cellSize / 2)
      expect(Math.abs(slot.worldY - row * cellSize)).toBeLessThan(cellSize / 2)
    }
  })

  it('computeJitteredGrid is deterministic for same seed + hashes', async () => {
    const { computeJitteredGrid } = await import('./layoutMath')
    const a = computeJitteredGrid(['x', 'y', 'z'], 99, 100)
    const b = computeJitteredGrid(['x', 'y', 'z'], 99, 100)
    expect(a).toEqual(b)
  })
})
