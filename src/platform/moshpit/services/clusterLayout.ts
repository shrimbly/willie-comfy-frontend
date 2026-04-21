/**
 * Phase 4 cluster layout packer (CONTEXT.md D-01/D-02/D-03/D-04/D-05/D-17,
 * GROUP-02/03/05/06/07/08/10, CSORT-01).
 *
 * Pure, worker-safe module: no Vue, no Pinia, no DOM. Consumes the grouping
 * primitives in `groupAxes.ts`, the existing `GridSlot` shape from
 * `layoutMath.ts`, and the `NormalizedParams` type from `paramNormalize.ts`.
 *
 * Algorithm (D-01):
 *   1. `computeNestingOrder` picks the outermost axis by largest avg bucket
 *      size across the active axis set; ties broken by GROUPING_AXES
 *      declaration order.
 *   2. `computeClusterLayout` recursively partitions visible hashes by the
 *      current axis's bucketKey. At the leaf (no axes remaining) the hashes
 *      are sorted by `compareAssetsForWithinCluster(withinSort)` and emitted
 *      as a row-wrapping flat grid.
 *   3. Child clusters are packed in a row-wrapping grid whose cell size is
 *      each child's bounding rectangle. Sibling gap = `gridSpacing *
 *      (maxDepth - currentDepth + 1)` per D-03.
 *
 * Perf (D-05): bucket-key computation is memoised per `(hash, axis)` via a
 * local `Map<string, string>` keyed by `${axis}|${hash}` so the 5k × 5-axis
 * recount stays inside the <100ms math budget. Enforced by a Vitest perf
 * marker at 5k hashes × 3 axes.
 */

import {
  GROUPING_AXES,
  bucketKey,
  compareAssetsForWithinCluster
} from './groupAxes'
import type { GroupingAxis, WithinClusterSortMode } from './groupAxes'
import type { GridSlot } from './layoutMath'
import type { NormalizedParams } from './paramNormalize'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClusterNode {
  readonly axis: GroupingAxis | null
  readonly bucketValue: string
  readonly depth: number
  readonly boundsWorld: {
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
  }
  readonly children: readonly ClusterNode[]
  readonly leafHashes: readonly string[]
}

export interface ClusterLayoutResult {
  readonly root: ClusterNode
  readonly slots: readonly GridSlot[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const AXIS_DECLARATION_INDEX: ReadonlyMap<GroupingAxis, number> = new Map(
  GROUPING_AXES.map((axis, index) => [axis, index])
)

type BucketKeyFn = (axis: GroupingAxis, hash: string) => string

function createBucketKeyMemo(
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  filenameByHash: ReadonlyMap<string, string | null>
): BucketKeyFn {
  const cache = new Map<string, string>()
  return (axis: GroupingAxis, hash: string): string => {
    const cacheKey = `${axis}|${hash}`
    const cached = cache.get(cacheKey)
    if (cached !== undefined) return cached
    const params = paramsByHash.get(hash)
    const filename = filenameByHash.get(hash) ?? null
    const value =
      params === undefined ? '(other)' : bucketKey(axis, params, filename)
    cache.set(cacheKey, value)
    return value
  }
}

// ---------------------------------------------------------------------------
// computeNestingOrder (D-02)
// ---------------------------------------------------------------------------

export function computeNestingOrder(
  visibleHashes: readonly string[],
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  filenameByHash: ReadonlyMap<string, string | null>,
  activeAxes: readonly GroupingAxis[]
): readonly GroupingAxis[] {
  if (activeAxes.length === 0) return []
  if (activeAxes.length === 1) return [activeAxes[0]]

  const getBucketKey = createBucketKeyMemo(paramsByHash, filenameByHash)

  // Compute unique-bucket count per axis.
  type AxisScore = {
    axis: GroupingAxis
    uniqueBucketCount: number
    declarationIndex: number
  }
  const scores: AxisScore[] = activeAxes.map((axis) => {
    const seen = new Set<string>()
    for (const hash of visibleHashes) {
      seen.add(getBucketKey(axis, hash))
    }
    return {
      axis,
      uniqueBucketCount: Math.max(1, seen.size),
      declarationIndex: AXIS_DECLARATION_INDEX.get(axis) ?? 0
    }
  })

  const total = visibleHashes.length
  scores.sort((a, b) => {
    const avgA = total / a.uniqueBucketCount
    const avgB = total / b.uniqueBucketCount
    if (avgB !== avgA) return avgB - avgA
    return a.declarationIndex - b.declarationIndex
  })

  return scores.map((s) => s.axis)
}

// ---------------------------------------------------------------------------
// computeClusterLayout (D-01/D-03/D-04/D-17)
// ---------------------------------------------------------------------------

export function computeClusterLayout(
  visibleHashes: readonly string[],
  paramsByHash: ReadonlyMap<string, NormalizedParams>,
  filenameByHash: ReadonlyMap<string, string | null>,
  activeGroupingsInOrder: readonly GroupingAxis[],
  withinClusterSort: WithinClusterSortMode,
  gridSpacing: number
): ClusterLayoutResult {
  const getBucketKey = createBucketKeyMemo(paramsByHash, filenameByHash)
  const maxDepth = activeGroupingsInOrder.length

  // Empty input short-circuit
  if (visibleHashes.length === 0) {
    return {
      root: {
        axis: null,
        bucketValue: '',
        depth: -1,
        boundsWorld: { x: 0, y: 0, w: 0, h: 0 },
        children: [],
        leafHashes: []
      },
      slots: []
    }
  }

  // Recursive packer — returns a ClusterNode positioned at local origin (0,0).
  function pack(
    hashes: readonly string[],
    remainingAxes: readonly GroupingAxis[],
    depth: number,
    bucketValue: string
  ): ClusterNode {
    // Leaf: no more axes to partition by.
    if (remainingAxes.length === 0) {
      return packLeaf(hashes, depth, bucketValue)
    }

    const currentAxis = remainingAxes[0]
    const nextAxes = remainingAxes.slice(1)

    // Group hashes by bucket key.
    const buckets = new Map<string, string[]>()
    for (const hash of hashes) {
      const key = getBucketKey(currentAxis, hash)
      const bucket = buckets.get(key)
      if (bucket) bucket.push(hash)
      else buckets.set(key, [hash])
    }

    // Build child clusters at local origin.
    type ChildWithKey = { node: ClusterNode; size: number; key: string }
    const unsorted: ChildWithKey[] = []
    for (const [key, bucketHashes] of buckets) {
      const child = pack(bucketHashes, nextAxes, depth + 1, key)
      unsorted.push({ node: child, size: bucketHashes.length, key })
    }

    // Sort siblings by descending size, ties broken by bucketValue ascending.
    unsorted.sort((a, b) => {
      if (b.size !== a.size) return b.size - a.size
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
    })

    // Pack children in a row-wrapping grid at this depth.
    const gap = gridSpacing * (maxDepth - depth + 1)
    const childCount = unsorted.length
    const columns = Math.max(1, Math.ceil(Math.sqrt(childCount)))

    // Determine row heights / column widths as the max child dims per row/col.
    const rowHeights: number[] = []
    const colWidths: number[] = []
    unsorted.forEach((child, i) => {
      const row = Math.floor(i / columns)
      const col = i % columns
      const w = child.node.boundsWorld.w
      const h = child.node.boundsWorld.h
      if (colWidths[col] === undefined || colWidths[col] < w) {
        colWidths[col] = w
      }
      if (rowHeights[row] === undefined || rowHeights[row] < h) {
        rowHeights[row] = h
      }
    })

    // Compute x-offsets per column and y-offsets per row.
    const colX: number[] = []
    let runningX = 0
    for (let c = 0; c < colWidths.length; c++) {
      colX.push(runningX)
      runningX += colWidths[c] + gap
    }
    const rowY: number[] = []
    let runningY = 0
    for (let r = 0; r < rowHeights.length; r++) {
      rowY.push(runningY)
      runningY += rowHeights[r] + gap
    }

    // Place each child at its (col, row) offset — apply the offset by
    // rebuilding the subtree with shifted bounds + slots (handled at emit).
    const positionedChildren: ClusterNode[] = unsorted.map((child, i) => {
      const row = Math.floor(i / columns)
      const col = i % columns
      return translateCluster(child.node, colX[col], rowY[row])
    })

    // Parent bounds: span all placed children.
    let maxX = 0
    let maxY = 0
    for (const c of positionedChildren) {
      const right = c.boundsWorld.x + c.boundsWorld.w
      const bottom = c.boundsWorld.y + c.boundsWorld.h
      if (right > maxX) maxX = right
      if (bottom > maxY) maxY = bottom
    }

    return {
      axis: currentAxis,
      bucketValue,
      depth,
      boundsWorld: { x: 0, y: 0, w: maxX, h: maxY },
      children: positionedChildren,
      leafHashes: []
    }
  }

  function packLeaf(
    hashes: readonly string[],
    depth: number,
    bucketValue: string
  ): ClusterNode {
    // Sort hashes per within-cluster comparator.
    const sortable = hashes.map((hash) => {
      const params =
        paramsByHash.get(hash) ??
        // Defensive fallback — property test allows hashes without params map
        // entries; treat them as oldest/empty.
        ({
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
          saveNodeIdentity: null
        } as NormalizedParams)
      const filename = filenameByHash.get(hash) ?? null
      return { contentHash: hash, params, filename }
    })
    sortable.sort((a, b) =>
      compareAssetsForWithinCluster(a, b, withinClusterSort)
    )

    const sortedHashes = sortable.map((s) => s.contentHash)
    const n = sortedHashes.length
    const columns = Math.max(1, Math.ceil(Math.sqrt(n)))
    const rows = Math.max(1, Math.ceil(n / columns))
    const w = columns * gridSpacing
    const h = rows * gridSpacing

    return {
      axis: null,
      bucketValue,
      depth,
      boundsWorld: { x: 0, y: 0, w, h },
      children: [],
      leafHashes: sortedHashes
    }
  }

  // Build the cluster tree positioned at local origin.
  const positionedRoot: ClusterNode =
    activeGroupingsInOrder.length === 0
      ? packLeaf(visibleHashes, 0, '')
      : pack(visibleHashes, activeGroupingsInOrder, 0, '')

  // Root sentinel (depth = -1) wraps the positioned tree — if we partitioned,
  // keep the packed tree's children as the root's children; otherwise the
  // packed leaf IS the root.
  const root: ClusterNode =
    activeGroupingsInOrder.length === 0
      ? positionedRoot
      : {
          axis: null,
          bucketValue: '',
          depth: -1,
          boundsWorld: positionedRoot.boundsWorld,
          children: positionedRoot.children,
          leafHashes: []
        }

  // Emit slots via post-order walk of the tree.
  const slots: GridSlot[] = []
  emitSlots(root, 0, 0, gridSpacing, slots)

  return { root, slots }
}

// ---------------------------------------------------------------------------
// Slot emission + cluster translation
// ---------------------------------------------------------------------------

function translateCluster(
  node: ClusterNode,
  dx: number,
  dy: number
): ClusterNode {
  return {
    axis: node.axis,
    bucketValue: node.bucketValue,
    depth: node.depth,
    boundsWorld: {
      x: node.boundsWorld.x + dx,
      y: node.boundsWorld.y + dy,
      w: node.boundsWorld.w,
      h: node.boundsWorld.h
    },
    children: node.children.map((c) => translateCluster(c, dx, dy)),
    leafHashes: node.leafHashes
  }
}

function emitSlots(
  node: ClusterNode,
  offsetX: number,
  offsetY: number,
  gridSpacing: number,
  out: GridSlot[]
): void {
  if (node.children.length === 0) {
    const n = node.leafHashes.length
    if (n === 0) return
    const columns = Math.max(1, Math.ceil(Math.sqrt(n)))
    // Sprites use anchor (0.5, 0.5) — `worldX/Y` is the sprite center. Place
    // centers at grid-cell midpoints so the visual envelope of the leaf
    // matches `boundsWorld` (which is `columns * gridSpacing` wide).
    const baseX = node.boundsWorld.x + offsetX + gridSpacing / 2
    const baseY = node.boundsWorld.y + offsetY + gridSpacing / 2
    for (let i = 0; i < n; i++) {
      const col = i % columns
      const row = Math.floor(i / columns)
      out.push({
        hash: node.leafHashes[i],
        worldX: baseX + col * gridSpacing,
        worldY: baseY + row * gridSpacing
      })
    }
    return
  }
  for (const child of node.children) {
    emitSlots(child, offsetX, offsetY, gridSpacing, out)
  }
}
