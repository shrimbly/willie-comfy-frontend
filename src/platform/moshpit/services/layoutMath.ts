/**
 * Pure layout math for the Moshpit jittered-grid chaos placement (D-01..D-04).
 *
 * Coordinate system: world-space pixels (matches pixi-viewport's worldWidth/
 * worldHeight). The `MoshpitCanvas.vue` sprite container sits inside the
 * `Viewport`, so world coords pan/zoom with the viewport.
 *
 * Jitter bound: strictly less than cellSize/2 so two adjacent slots never
 * overlap geometrically (D-01).
 *
 * Determinism: same (hashes, seed, cellSize) always produces the same slots.
 * This drives the filter-hash-seeded layout story (D-02): re-entering the same
 * filter snaps the user back into the same spatial arrangement so muscle
 * memory works.
 */

import { mulberry32 } from './contentHash'

export interface GridSlot {
  readonly hash: string
  readonly worldX: number
  readonly worldY: number
}

export interface GridDimensions {
  readonly cols: number
  readonly rows: number
}

/**
 * D-03: square bounding region with `ceil(sqrt(N))` cells per side.
 * For non-square counts, `rows` is the minimum number needed to hold N items
 * given `cols` columns.
 */
export function computeSquareGridDimensions(n: number): GridDimensions {
  if (n <= 0) return { cols: 0, rows: 0 }
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  return { cols, rows }
}

/**
 * D-01 / D-02: Deterministic jittered grid. Each slot is assigned to its
 * positional cell (row-major by input order — the caller is responsible for
 * sorting the input for D-02 determinism across reloads); jitter is sampled
 * from `mulberry32(seed)` and scaled to strictly less than cellSize/2.
 *
 * Using 0.49 instead of 0.5 keeps jitter strictly below the bound even
 * after floating-point rounding, satisfying D-01's strict inequality.
 */
export function computeJitteredGrid(
  hashes: readonly string[],
  seed: number,
  cellSize: number
): GridSlot[] {
  if (hashes.length === 0) return []
  const { cols } = computeSquareGridDimensions(hashes.length)
  const rng = mulberry32(seed)
  const maxJitter = cellSize * 0.49

  const slots: GridSlot[] = new Array(hashes.length)
  for (let i = 0; i < hashes.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const jitterX = (rng() - 0.5) * 2 * maxJitter
    const jitterY = (rng() - 0.5) * 2 * maxJitter
    slots[i] = {
      hash: hashes[i],
      worldX: col * cellSize + jitterX,
      worldY: row * cellSize + jitterY
    }
  }
  return slots
}

/**
 * D-04: Packed grid — identical cell assignment as the jittered grid but with
 * zero jitter. Targets the re-pack tween after metadata-excluded assets have
 * dropped out and the surviving set is re-laid.
 */
export function computePackedGrid(
  hashes: readonly string[],
  cellSize: number
): GridSlot[] {
  if (hashes.length === 0) return []
  const { cols } = computeSquareGridDimensions(hashes.length)
  const slots: GridSlot[] = new Array(hashes.length)
  for (let i = 0; i < hashes.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    slots[i] = {
      hash: hashes[i],
      worldX: col * cellSize,
      worldY: row * cellSize
    }
  }
  return slots
}
