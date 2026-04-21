/**
 * Moshpit thumbnail worker — ASSET-02, ASSET-05, ASSET-07.
 *
 * Responsibilities:
 *  1. Fetch the full-res (or thumbnail if available) asset bytes
 *  2. Parse PNG metadata via getFromPngBuffer; if empty → post `excluded`
 *  3. Resize to 512px max dimension (preserve aspect); encode WebP
 *  4. Content-hash the buffer (cloud fast-path via asset_hash; else SHA-256)
 *  5. postMessage `thumbReady` with blob + meta + hash
 *
 * Concurrency cap = 4 (WORKER_CONCURRENCY_CAP); additional enqueues wait in a
 * FIFO promise queue.
 *
 * AbortController: `abort` / `abortAll` messages abort the corresponding
 * in-flight operation. `fetch` honours `signal`; `createImageBitmap` does not
 * accept a signal, so it's raced against an abort-signal promise.
 *
 * Worker bundle constraint: NO imports from Vue / Pinia / DOM-only libs.
 * The two allowed imports are `@/scripts/metadata/png.ts` (worker-safe — uses
 * only ArrayBuffer/DataView/TextDecoder/DecompressionStream) and the leaf
 * `contentHash.ts` / `workerMessages.ts` modules.
 */

/// <reference lib="webworker" />

import { sha256Hex } from '@/platform/moshpit/services/contentHash'
import type { NormalizedParams } from '@/platform/moshpit/services/paramNormalize'
import { normalizeParams } from '@/platform/moshpit/services/paramNormalize'
import type {
  EnqueueAssetInput,
  WorkerInMessage,
  WorkerOutMessage
} from '@/platform/moshpit/services/workerMessages'
import {
  THUMB_MAX_DIMENSION,
  WEBP_QUALITY,
  WORKER_CONCURRENCY_CAP
} from '@/platform/moshpit/services/workerMessages'
import { getFromPngBuffer } from '@/scripts/metadata/png'

// ---------- pure handler (exported for unit tests) -----------

export interface ProcessCtx {
  fetchFn: typeof fetch
  postMessage: (msg: WorkerOutMessage, transfer?: Transferable[]) => void
  encodeThumb: (
    bytes: ArrayBuffer
  ) => Promise<{ blob: Blob; width: number; height: number }>
  parseMetadata: (bytes: ArrayBuffer) => Promise<Record<string, string>>
  hash: (bytes: ArrayBuffer) => Promise<string>
  /** Accepts optional source filename for the workflowFilename heuristic. */
  normalize: (
    raw: Record<string, string>,
    createdAtMs: number,
    sourceFilename?: string | null
  ) => NormalizedParams
  /** Returns current epoch ms — injectable for tests. */
  now: () => number
}

/**
 * Extract the filename from an asset fetch URL. Used to supply
 * `workflowFilename` to `normalizeParams` so the workflow picker can display a
 * human-readable name.
 *
 * ComfyUI's `/api/view?filename=…&subfolder=…&type=output` endpoint carries the
 * real filename in the `filename` query parameter, not the URL path. Prefer
 * that when present; fall back to the last path segment for direct-file URLs.
 */
export function deriveFilenameFromAssetInput(
  input: EnqueueAssetInput
): string | null {
  const raw = input.fetchUrl
  const queryIndex = raw.indexOf('?')
  const pathPart = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw
  const queryPart = queryIndex >= 0 ? raw.slice(queryIndex + 1) : ''

  if (queryPart.length > 0) {
    const params = new URLSearchParams(queryPart)
    const filename = params.get('filename')
    if (filename !== null && filename.length > 0) return filename
  }

  const segments = pathPart.split('/')
  const last = segments[segments.length - 1]
  return last && last.length > 0 ? last : null
}

export async function processAsset(
  input: EnqueueAssetInput,
  signal: AbortSignal,
  ctx: ProcessCtx
): Promise<void> {
  if (signal.aborted) return
  const { id, filterId, fetchUrl, assetHash, assetId } = input

  let buffer: ArrayBuffer
  try {
    const res = await ctx.fetchFn(fetchUrl, { signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    buffer = await res.arrayBuffer()
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') return
    ctx.postMessage({ type: 'excluded', id, filterId, reason: 'fetch-failed' })
    return
  }
  if (signal.aborted) return

  let metadata: Record<string, string>
  try {
    metadata = await ctx.parseMetadata(buffer)
  } catch {
    ctx.postMessage({ type: 'excluded', id, filterId, reason: 'decode-failed' })
    return
  }
  if (signal.aborted) return
  if (Object.keys(metadata).length === 0) {
    ctx.postMessage({ type: 'excluded', id, filterId, reason: 'no-metadata' })
    return
  }

  let thumb: { blob: Blob; width: number; height: number }
  try {
    thumb = await ctx.encodeThumb(buffer)
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') return
    ctx.postMessage({ type: 'excluded', id, filterId, reason: 'decode-failed' })
    return
  }
  if (signal.aborted) return

  const contentHash =
    assetHash && assetHash.length > 0 ? assetHash : await ctx.hash(buffer)
  if (signal.aborted) return

  // Prefer the real asset mtime supplied by the main thread over ingest time,
  // so the `newestFirst` within-cluster sort lands on the same order the
  // registry presents during populate.
  const createdAtMs = input.createdAtMs ?? ctx.now()
  const sourceFilename = deriveFilenameFromAssetInput(input)
  const params = ctx.normalize(metadata, createdAtMs, sourceFilename)

  ctx.postMessage(
    {
      type: 'thumbReady',
      id,
      filterId,
      contentHash,
      blob: thumb.blob,
      width: thumb.width,
      height: thumb.height,
      metadata,
      // Echo assetId back so the main-thread bridge can record the
      // asset.id → contentHash mapping for OSS-path assets (no asset_hash).
      assetId,
      params
    }
    // Blob is structured-cloneable; no transferable list needed. Keeping the
    // signature open for future Transferable-based optimisation.
  )
}

// ---------- worker shell (only runs inside the Worker) -----------

async function encodeThumbReal(
  bytes: ArrayBuffer
): Promise<{ blob: Blob; width: number; height: number }> {
  const srcBlob = new Blob([bytes])
  const srcBitmap = await createImageBitmap(srcBlob)
  const scale =
    THUMB_MAX_DIMENSION / Math.max(srcBitmap.width, srcBitmap.height)
  const dstW = Math.max(1, Math.round(srcBitmap.width * scale))
  const dstH = Math.max(1, Math.round(srcBitmap.height * scale))
  const resized = await createImageBitmap(srcBitmap, {
    resizeWidth: dstW,
    resizeHeight: dstH,
    resizeQuality: 'high'
  })
  srcBitmap.close()

  const canvas = new OffscreenCanvas(dstW, dstH)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable')
  ctx.drawImage(resized, 0, 0)
  resized.close()

  const blob = await canvas.convertToBlob({
    type: 'image/webp',
    quality: WEBP_QUALITY
  })
  return { blob, width: dstW, height: dstH }
}

// Concurrency pool + abort map (worker-scoped module state).
const inFlight = new Map<string, AbortController>()
const queue: EnqueueAssetInput[] = []
let active = 0

function schedule(): void {
  while (active < WORKER_CONCURRENCY_CAP && queue.length > 0) {
    const input = queue.shift()
    if (!input) break
    const ac = new AbortController()
    inFlight.set(input.id, ac)
    active++
    processAsset(input, ac.signal, {
      fetchFn: fetch.bind(globalThis),
      postMessage: (msg) => self.postMessage(msg),
      encodeThumb: encodeThumbReal,
      parseMetadata: (buf) => getFromPngBuffer(buf),
      hash: sha256Hex,
      normalize: normalizeParams,
      now: () => Date.now()
    }).finally(() => {
      inFlight.delete(input.id)
      active--
      schedule()
    })
  }
}

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data
  switch (msg.type) {
    case 'enqueue':
      queue.push(msg.input)
      schedule()
      return
    case 'abort': {
      const ac = inFlight.get(msg.id)
      ac?.abort()
      // Also drop pending-in-queue entries with this id
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].id === msg.id) queue.splice(i, 1)
      }
      return
    }
    case 'abortAll': {
      inFlight.forEach((ac) => ac.abort())
      queue.length = 0
      return
    }
    default: {
      // Exhaustiveness guard
      const _exhaustive: never = msg
      void _exhaustive
    }
  }
}
