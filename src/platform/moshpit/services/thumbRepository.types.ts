import type { DBSchema } from 'idb'

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
 * Increment if Phase 5 adds indexes (e.g. by-tag on assetMeta).
 * Always provide an `upgrade` branch for the new version number.
 */
export const MOSHPIT_DB_VERSION = 1
