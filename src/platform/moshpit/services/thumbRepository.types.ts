import type { DBSchema } from 'idb'

import type { NormalizedParams } from './paramNormalize'

/** Phase 5 mutation target. Plain data — no methods. */
export interface CurationRecord {
  readonly favourite: boolean
  readonly tags: readonly string[]
  readonly folders: readonly string[]
  readonly hidden: boolean
}

export interface ThumbRecord {
  readonly contentHash: string
  readonly blob: Blob
  readonly width: number
  readonly height: number
  /** epoch ms — informational; used for future LRU/eviction (v2). */
  readonly generatedAt: number
}

export interface AssetMetaRecord {
  readonly contentHash: string
  /**
   * Raw string key/value map from getFromPngBuffer — parsed JSON lives in
   * the `workflow`/`prompt` fields per ComfyUI convention.
   */
  readonly metadata: Readonly<Record<string, string>>
  readonly curation: CurationRecord
  /** Added in MOSHPIT_DB_VERSION 2. Populated by normalizeParams in the upgrade callback. */
  readonly params: NormalizedParams
}

/** idb typed schema — passed as generic to `openDB<MoshpitDB>`. */
export interface MoshpitDB extends DBSchema {
  thumbs: {
    key: string
    value: ThumbRecord
  }
  assetMeta: {
    key: string
    value: AssetMetaRecord
  }
}

export const MOSHPIT_DB_NAME = 'moshpit-v1'
/**
 * v1: initial stores (no params field).
 * v2 (Phase 3 Plan 04): assetMeta gains `params: NormalizedParams`.
 * v3 (Phase 4 Plan 02): `params.saveNodeIdentity` added — re-derived from
 *   rec.metadata by a cursor-based upgrade (D-11). Per-record try/catch with
 *   aggregate skip counter; upgrade transaction never aborts (Pitfall 4).
 *
 * Increment again if Phase 5 adds indexes (e.g. by-tag on assetMeta);
 * always provide an `upgrade` branch for the new version number.
 */
export const MOSHPIT_DB_VERSION = 3
