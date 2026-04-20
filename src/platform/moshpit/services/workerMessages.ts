/**
 * Strict discriminated-union message contract for the Moshpit thumbnail worker.
 *
 * Both sides (`thumbWorker.ts` and `workerBridge.ts`) import from this leaf
 * module. Because the contract is a discriminated union on `type`, TypeScript
 * exhaustiveness checking (`switch` with `never` default) catches missing
 * handlers at compile time.
 *
 * NEVER add fields to existing variants without a version bump on
 * `MOSHPIT_DB_VERSION` — the `metadata` field is persisted downstream and a
 * breaking change would orphan IDB rows.
 */

export interface EnqueueAssetInput {
  readonly id: string // caller-assigned: `${filterId}:${asset.id}`
  readonly filterId: string // stale-response guard (RESEARCH §6)
  readonly fetchUrl: string // main thread resolved via getAssetUrl
  readonly assetHash: string | null // cloud fast-path; null → client hash
  /** AssetItem.id — echoed back in thumbReady for OSS-path hash bridging. */
  readonly assetId: string
}

export type WorkerInMessage =
  | { readonly type: 'enqueue'; readonly input: EnqueueAssetInput }
  | { readonly type: 'abort'; readonly id: string }
  | { readonly type: 'abortAll' }

export interface ThumbReadyMessage {
  readonly type: 'thumbReady'
  readonly id: string
  readonly filterId: string
  readonly contentHash: string
  readonly blob: Blob
  readonly width: number
  readonly height: number
  readonly metadata: Record<string, string>
  /** Echoed from EnqueueAssetInput.assetId — bridges OSS-path assets whose
   *  server-side asset_hash is null back to their AssetItem.id. */
  readonly assetId: string
}

export interface ExcludedMessage {
  readonly type: 'excluded'
  readonly id: string
  readonly filterId: string
  readonly reason: 'no-metadata' | 'fetch-failed' | 'decode-failed'
}

export interface ErrorMessage {
  readonly type: 'error'
  readonly id: string
  readonly filterId: string
  readonly message: string
}

export type WorkerOutMessage =
  | ThumbReadyMessage
  | ExcludedMessage
  | ErrorMessage

export const THUMB_MAX_DIMENSION = 512
export const WEBP_QUALITY = 0.85
export const WORKER_CONCURRENCY_CAP = 4
