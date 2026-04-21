/**
 * Grouping-axis primitives for Phase 4 lineage clustering (CONTEXT.md
 * D-07 / D-08 / D-09 / D-10; GROUP-03/05/06/07/08; CSORT-01).
 *
 * Pure, worker-safe module: no Vue, no Pinia, no DOM. Only `import type`
 * dependencies on `paramNormalize` so this module is safe to evaluate inside
 * the thumbnail worker and any future worker-side layout pipeline.
 *
 * Exports five axis-extraction primitives + the global within-cluster
 * comparator used by `clusterLayout.ts` at leaf clusters.
 *
 * `saveNodeIdentity` on NormalizedParams lands in Plan 02 — this module reads
 * it via a narrow structural widening so Plan 01 can ship independently.
 */

import type { NormalizedParams } from './paramNormalize'

export const GROUPING_AXES = [
  'workflow',
  'saveNode',
  'prompt',
  'model',
  'type'
] as const
export type GroupingAxis = (typeof GROUPING_AXES)[number]

export type WithinClusterSortMode =
  | 'newestFirst'
  | 'oldestFirst'
  | 'alphabetical'

export const WITHIN_CLUSTER_SORT_MODES: readonly WithinClusterSortMode[] = [
  'newestFirst',
  'oldestFirst',
  'alphabetical'
]

export const OTHER_BUCKET_KEY = '(other)'

type ParamsWithSaveNode = NormalizedParams & {
  readonly saveNodeIdentity?: string | null
}

/**
 * D-10: prompt grouping key.
 *
 * `trim().toLowerCase().replace(/\s+/g, ' ')`. Empty or whitespace-only input
 * (including `undefined`) resolves to `OTHER_BUCKET_KEY` so missing prompts
 * fall into the (other) cluster at the prompt-grouping level.
 */
export function normalisePromptKey(prompt: string | undefined): string {
  if (prompt === undefined) return OTHER_BUCKET_KEY
  const normalised = prompt.trim().toLowerCase().replace(/\s+/g, ' ')
  return normalised.length > 0 ? normalised : OTHER_BUCKET_KEY
}

/**
 * D-09: type grouping via aspect-ratio bucket.
 *
 * `width / height` — `> 1.15` → landscape, `< 0.87` → portrait, otherwise
 * square. Missing / non-finite / zero dimensions resolve to `OTHER_BUCKET_KEY`.
 * Derived at read time; not persisted on NormalizedParams.
 */
export function deriveTypeBucket(
  params: Pick<NormalizedParams, 'width' | 'height'>
): 'landscape' | 'portrait' | 'square' | typeof OTHER_BUCKET_KEY {
  const { width, height } = params
  if (
    width === undefined ||
    height === undefined ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width === 0 ||
    height === 0
  ) {
    return OTHER_BUCKET_KEY
  }
  const ratio = width / height
  if (ratio > 1.15) return 'landscape'
  if (ratio < 0.87) return 'portrait'
  return 'square'
}

/**
 * Map a (NormalizedParams, axis) pair to its grouping bucket label.
 * Missing / null values resolve to `OTHER_BUCKET_KEY` per D-04.
 *
 * `_filenameOfAsset` is reserved for future axes that key on the source PNG
 * filename rather than a NormalizedParams field; v1 does not consume it.
 */
export function bucketKey(
  axis: GroupingAxis,
  params: NormalizedParams,
  _filenameOfAsset: string | null
): string {
  switch (axis) {
    case 'workflow':
      return params.workflowFilename ?? OTHER_BUCKET_KEY
    case 'saveNode': {
      const identity = (params as ParamsWithSaveNode).saveNodeIdentity
      return identity ?? OTHER_BUCKET_KEY
    }
    case 'prompt':
      return normalisePromptKey(params.positivePrompt)
    case 'model':
      return params.model ?? OTHER_BUCKET_KEY
    case 'type':
      return deriveTypeBucket(params)
  }
}

/**
 * CSORT-01: within-cluster global comparator.
 *
 * Primary key depends on mode; ties are broken deterministically on
 * `contentHash` ascending so the ordering is total for any distinct-hash
 * asset set.
 */
export function compareAssetsForWithinCluster(
  a: {
    readonly contentHash: string
    readonly params: NormalizedParams
    readonly filename: string | null
  },
  b: {
    readonly contentHash: string
    readonly params: NormalizedParams
    readonly filename: string | null
  },
  mode: WithinClusterSortMode
): number {
  let primary = 0
  switch (mode) {
    case 'newestFirst':
      primary = b.params.timestamp - a.params.timestamp
      break
    case 'oldestFirst':
      primary = a.params.timestamp - b.params.timestamp
      break
    case 'alphabetical': {
      const af = a.filename
      const bf = b.filename
      if (af === null && bf === null) primary = 0
      else if (af === null) primary = 1
      else if (bf === null) primary = -1
      else primary = af < bf ? -1 : af > bf ? 1 : 0
      break
    }
  }
  if (primary !== 0) return primary
  return a.contentHash < b.contentHash
    ? -1
    : a.contentHash > b.contentHash
      ? 1
      : 0
}
