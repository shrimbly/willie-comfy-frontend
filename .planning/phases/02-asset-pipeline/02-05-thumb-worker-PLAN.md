---
phase: 02-asset-pipeline
plan: 05
type: execute
wave: 2
depends_on: ['02-02']
files_modified:
  - src/platform/moshpit/services/thumbWorker.ts
  - src/platform/moshpit/services/workerMessages.ts
  - src/platform/moshpit/services/thumbWorker.test.ts
autonomous: true
requirements: [ASSET-02, ASSET-05, ASSET-07]
tags: [web-worker, offscreen-canvas, webp, wave-2]
must_haves:
  truths:
    - 'A Vite `?worker` module at `src/platform/moshpit/services/thumbWorker.ts` runs off-main-thread and handles three message types: `enqueue`, `abort`, `abortAll`'
    - 'The worker fetches the asset URL with an AbortSignal, calls `getFromPngBuffer`, and posts `excluded` when metadata is empty (ASSET-05)'
    - 'On success the worker posts `thumbReady` with `{ contentHash, blob, width, height, metadata }` where `blob` is a 512-px-max WebP produced via `createImageBitmap` resize + `OffscreenCanvas.convertToBlob` (ASSET-02)'
    - 'Worker maintains an in-flight concurrency cap of 4 — additional enqueues wait for a slot'
    - 'AbortController propagates: `fetch` honours `signal`; `createImageBitmap` is raced against an abort-signal promise'
    - 'Content hash uses `AssetItem.asset_hash` when non-null/non-empty (cloud fast path); otherwise `sha256Hex` on the fetched buffer'
    - 'Message contract is a strict discriminated union exported from `workerMessages.ts` — both sides import the same types'
    - 'Unit test `thumbWorker.test.ts` exercises the pure handler function (not the full worker) with mocked fetch + crypto.subtle + OffscreenCanvas, proving enqueue→thumbReady and enqueue→excluded paths'
  artifacts:
    - path: 'src/platform/moshpit/services/workerMessages.ts'
      provides: 'Strict discriminated union message contract shared by worker + main thread'
      contains: 'export type WorkerInMessage'
    - path: 'src/platform/moshpit/services/thumbWorker.ts'
      provides: 'Web Worker — enqueue handler, abort handler, concurrency cap of 4'
      contains: 'self.onmessage'
    - path: 'src/platform/moshpit/services/thumbWorker.test.ts'
      provides: 'Unit tests for the pure handler (processAsset) with mocked fetch + OffscreenCanvas'
      contains: "describe('processAsset"
  key_links:
    - from: 'src/platform/moshpit/services/thumbWorker.ts'
      to: 'src/platform/moshpit/services/contentHash.ts'
      via: 'import { sha256Hex }'
      pattern: "import \\{ sha256Hex"
    - from: 'src/platform/moshpit/services/thumbWorker.ts'
      to: 'src/scripts/metadata/png.ts'
      via: 'import { getFromPngBuffer }'
      pattern: "import \\{ getFromPngBuffer"
---

<objective>
Build the Web Worker that turns an asset URL into a WebP thumbnail + parsed metadata + content hash, and the strict message-contract module that both worker and main thread import. Establish the first `?worker` import precedent in this repo.

Two code surfaces:

1. `workerMessages.ts` — leaf-module discriminated union, no runtime code.
2. `thumbWorker.ts` — the worker itself. Fetches, validates metadata, resizes, encodes WebP, hashes, posts back. Honours AbortController. Caps concurrency at 4.

Also ship `thumbWorker.test.ts` that tests the pure handler factored out of the worker shell — so the resize/WebP/hash logic is unit-tested without needing a real worker.

Purpose: Off-main-thread generation of 512px WebP thumbs per ASSET-02 / ASSET-07. Assets without ComfyUI metadata are excluded at this layer (ASSET-05).

Output: Two production files + one test file. ~250 LOC total including tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-asset-pipeline/02-RESEARCH.md
@.planning/phases/02-asset-pipeline/02-CONTEXT.md
@src/scripts/metadata/png.ts
@src/platform/moshpit/services/contentHash.ts

<interfaces>
Public types exported from `src/platform/moshpit/services/workerMessages.ts`:

```typescript
export interface EnqueueAssetInput {
  readonly id: string // caller-assigned: `${filterId}:${asset.id}`
  readonly filterId: string // stale-response guard (RESEARCH §6)
  readonly fetchUrl: string // main thread resolved via getAssetUrl
  readonly assetHash: string | null // cloud fast-path; null → client hash
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
```

Public handler exposed for testing (from `thumbWorker.ts`):

```typescript
// Pure handler factored out of `self.onmessage` so it can be unit-tested
// without a real Worker. The worker shell imports this and wires it to
// self.onmessage + postMessage + self.crypto.
export async function processAsset(
  input: EnqueueAssetInput,
  signal: AbortSignal,
  ctx: {
    fetchFn: typeof fetch
    postMessage: (msg: WorkerOutMessage, transfer?: Transferable[]) => void
    encodeThumb: (
      bytes: ArrayBuffer
    ) => Promise<{ blob: Blob; width: number; height: number }>
    parseMetadata: (bytes: ArrayBuffer) => Promise<Record<string, string>>
    hash: (bytes: ArrayBuffer) => Promise<string>
  }
): Promise<void>
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create the shared message contract module (workerMessages.ts)</name>
  <read_first>
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §Vite Web Worker + Typed Message Contract
    - .planning/phases/02-asset-pipeline/02-UI-SPEC.md §Copywriting Contract (for the error-reason enum vocabulary)
  </read_first>
  <action>
Create `src/platform/moshpit/services/workerMessages.ts` with EXACTLY the types in the `<interfaces>` block above. No runtime code apart from the three `export const` values for `THUMB_MAX_DIMENSION`, `WEBP_QUALITY`, `WORKER_CONCURRENCY_CAP`.

Include a top-of-file JSDoc:

```typescript
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
```

All fields `readonly`. All arrays `readonly string[]` where applicable. No `any`.
</action>
<verify>
<automated>pnpm typecheck 2>&amp;1 | tail -5</automated>
</verify>
<acceptance_criteria> - `test -f src/platform/moshpit/services/workerMessages.ts` exits 0 - `grep "export type WorkerInMessage" src/platform/moshpit/services/workerMessages.ts` returns a match - `grep "export type WorkerOutMessage" src/platform/moshpit/services/workerMessages.ts` returns a match - `grep "THUMB_MAX_DIMENSION = 512" src/platform/moshpit/services/workerMessages.ts` returns a match - `grep "WORKER_CONCURRENCY_CAP = 4" src/platform/moshpit/services/workerMessages.ts` returns a match - File has NO runtime imports (type-only contract) - `pnpm typecheck` exits 0
</acceptance_criteria>
<done>Shared message contract exists; typecheck clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement thumbWorker.ts with factored pure `processAsset` handler</name>
  <read_first>
    - src/scripts/metadata/png.ts (confirm `getFromPngBuffer` is worker-safe — uses only ArrayBuffer / Uint8Array / DataView / TextDecoder / DecompressionStream)
    - src/platform/moshpit/services/contentHash.ts (for `sha256Hex` import)
    - src/platform/moshpit/services/workerMessages.ts (just created — message shapes)
    - src/renderer/glsl/useGLSLRenderer.ts lines 190–210 and 435–450 (precedent: OffscreenCanvas + convertToBlob({type:'image/webp'}))
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §3 Worker Architecture + §OffscreenCanvas WebP Encode Path + §AbortController Propagation Into Worker
    - .planning/phases/02-asset-pipeline/02-CONTEXT.md D-06 (cancel semantics) and D-08 (warm cache)
  </read_first>
  <behavior>
    - processAsset({ id, filterId, fetchUrl, assetHash: 'abc' }, signal, mocked-ctx) with non-empty metadata → postMessage called ONCE with `{ type: 'thumbReady', contentHash: 'abc', ... }`
    - processAsset with metadata `{}` (no-metadata) → postMessage called ONCE with `{ type: 'excluded', reason: 'no-metadata' }`, no `thumbReady`
    - processAsset with `assetHash: null` → calls ctx.hash(buffer); contentHash in outgoing message matches the hash function result
    - processAsset with aborted signal at call time → posts nothing (silently cancels); does not throw
    - fetch failure → posts `{ type: 'excluded', reason: 'fetch-failed' }`
    - Concurrency cap 4: when enqueue #5 arrives while 4 are in-flight, it waits
  </behavior>
  <action>
Create `src/platform/moshpit/services/thumbWorker.ts`. Structure: a pure `processAsset` function (the tested unit), plus the worker shell at the bottom that wires `self.onmessage` → `processAsset` with a real fetch/encodeThumb/parseMetadata/hash context.

```typescript
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
}

export async function processAsset(
  input: EnqueueAssetInput,
  signal: AbortSignal,
  ctx: ProcessCtx
): Promise<void> {
  if (signal.aborted) return
  const { id, filterId, fetchUrl, assetHash } = input

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

  ctx.postMessage(
    {
      type: 'thumbReady',
      id,
      filterId,
      contentHash,
      blob: thumb.blob,
      width: thumb.width,
      height: thumb.height,
      metadata
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
      hash: sha256Hex
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
```

Also create `src/platform/moshpit/services/thumbWorker.test.ts` to exercise the pure `processAsset`:

```typescript
import { describe, expect, it, vi } from 'vitest'

import { processAsset } from './thumbWorker'
import type { WorkerOutMessage } from './workerMessages'

function makeCtx(
  overrides: {
    fetchOk?: boolean
    parseResult?: Record<string, string>
    hashResult?: string
    thumb?: { blob: Blob; width: number; height: number }
  } = {}
) {
  const posted: WorkerOutMessage[] = []
  return {
    posted,
    ctx: {
      fetchFn: vi.fn(async () => ({
        ok: overrides.fetchOk !== false,
        status: overrides.fetchOk === false ? 500 : 200,
        arrayBuffer: async () => new ArrayBuffer(8)
      })) as unknown as typeof fetch,
      postMessage: (msg: WorkerOutMessage) => posted.push(msg),
      encodeThumb: vi.fn(
        async () =>
          overrides.thumb ?? {
            blob: new Blob(['webp'], { type: 'image/webp' }),
            width: 512,
            height: 512
          }
      ),
      parseMetadata: vi.fn(
        async () => overrides.parseResult ?? { workflow: '{}' }
      ),
      hash: vi.fn(async () => overrides.hashResult ?? 'CLIENT_HASH')
    }
  }
}

describe('processAsset', () => {
  const baseInput = {
    id: 'f1:a1',
    filterId: 'f1',
    fetchUrl: 'https://example.test/a.png',
    assetHash: 'CLOUD_HASH'
  }

  it('posts thumbReady with cloud asset_hash on happy path', async () => {
    const { posted, ctx } = makeCtx()
    await processAsset(baseInput, new AbortController().signal, ctx)
    expect(posted).toHaveLength(1)
    expect(posted[0].type).toBe('thumbReady')
    if (posted[0].type === 'thumbReady') {
      expect(posted[0].contentHash).toBe('CLOUD_HASH')
      expect(posted[0].width).toBe(512)
      expect(posted[0].metadata).toEqual({ workflow: '{}' })
    }
    expect(ctx.hash).not.toHaveBeenCalled()
  })

  it('falls back to client-side hash when assetHash is null', async () => {
    const { posted, ctx } = makeCtx()
    await processAsset(
      { ...baseInput, assetHash: null },
      new AbortController().signal,
      ctx
    )
    expect(posted[0].type).toBe('thumbReady')
    if (posted[0].type === 'thumbReady') {
      expect(posted[0].contentHash).toBe('CLIENT_HASH')
    }
    expect(ctx.hash).toHaveBeenCalledTimes(1)
  })

  it('posts excluded with reason no-metadata when parse returns {}', async () => {
    const { posted, ctx } = makeCtx({ parseResult: {} })
    await processAsset(baseInput, new AbortController().signal, ctx)
    expect(posted).toHaveLength(1)
    expect(posted[0].type).toBe('excluded')
    if (posted[0].type === 'excluded')
      expect(posted[0].reason).toBe('no-metadata')
    expect(ctx.encodeThumb).not.toHaveBeenCalled()
  })

  it('posts excluded with reason fetch-failed on HTTP error', async () => {
    const { posted, ctx } = makeCtx({ fetchOk: false })
    await processAsset(baseInput, new AbortController().signal, ctx)
    expect(posted).toHaveLength(1)
    expect(posted[0].type).toBe('excluded')
    if (posted[0].type === 'excluded')
      expect(posted[0].reason).toBe('fetch-failed')
  })

  it('posts nothing and returns silently when signal is already aborted', async () => {
    const { posted, ctx } = makeCtx()
    const ac = new AbortController()
    ac.abort()
    await processAsset(baseInput, ac.signal, ctx)
    expect(posted).toHaveLength(0)
  })
})
```

Constraints:

- The `<reference lib="webworker" />` directive is REQUIRED for `self`, `OffscreenCanvas`, `createImageBitmap` types.
- DO NOT import anything from `@/stores`, `vue`, `pinia`, `@/components`.
- DO NOT duplicate `sha256Hex` — always import from `contentHash.ts`.
- Concurrency cap = `WORKER_CONCURRENCY_CAP` (imported) — do not hardcode `4` in the worker shell.
  </action>
  <verify>
  <automated>pnpm test:unit --run src/platform/moshpit/services/thumbWorker.test.ts &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria> - `test -f src/platform/moshpit/services/thumbWorker.ts` exits 0 - `test -f src/platform/moshpit/services/thumbWorker.test.ts` exits 0 - `grep "/// <reference lib=\"webworker\" />" src/platform/moshpit/services/thumbWorker.ts` returns a match - `grep "export async function processAsset" src/platform/moshpit/services/thumbWorker.ts` returns a match - `grep "self.onmessage" src/platform/moshpit/services/thumbWorker.ts` returns a match - `grep "WORKER_CONCURRENCY_CAP" src/platform/moshpit/services/thumbWorker.ts` returns at least 2 matches (import + use) - `grep "getFromPngBuffer" src/platform/moshpit/services/thumbWorker.ts` returns a match - `grep "sha256Hex" src/platform/moshpit/services/thumbWorker.ts` returns a match - `grep "convertToBlob({[^}]*type: 'image/webp'" src/platform/moshpit/services/thumbWorker.ts` returns a match - `grep "as any\|: any\b" src/platform/moshpit/services/thumbWorker.ts` returns zero matches - `pnpm test:unit --run src/platform/moshpit/services/thumbWorker.test.ts` exits 0 with 5 tests passing - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Worker shell + pure handler + 5 passing unit tests; typecheck clean; first `?worker`-ready module in the repo.</done>
  </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                               | Description                                                                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker ← attacker-controlled URL       | `fetch(fetchUrl)` — the URL is resolved by the main thread via `getAssetUrl` against the local ComfyUI API or cloud service, but if an attacker could inject a URL they could redirect to any origin |
| Worker ← attacker-controlled PNG bytes | `getFromPngBuffer` parses tEXt/iTXt chunks including zlib-decompressed iTXt; a malicious PNG could zlib-bomb                                                                                         |
| Worker → main thread                   | `postMessage` returns arbitrary `metadata` strings from the PNG parser                                                                                                                               |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                                            | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------- | -------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-02-05-01 | Information Disclosure | Worker `fetch(fetchUrl)` could leak auth cookies to arbitrary origin | mitigate    | The main thread (Plan 06 `workerBridge`) resolves URLs via `getAssetUrl` — always same-origin (ComfyUI backend) or cloud service. Worker treats URL as opaque but the bridge layer is the trust gate. Document in Plan 06 that only `getAssetUrl`-produced URLs may be posted to the worker. ASVS L1 V11.1.2.                   |
| T-02-05-02 | Denial of Service      | zlib-decompression bomb in iTXt chunk                                | mitigate    | `getFromPngBuffer` wraps decompression in `DecompressionStream` which is browser-native and has internal bounds. The `try/catch` around `ctx.parseMetadata(buffer)` converts any crash into `excluded/decode-failed` — the user sees the asset skipped rather than the app crashing. Test case covers this path. ASVS L1 V12.4. |
| T-02-05-03 | Denial of Service      | Malicious large PNG (e.g. 1 GB)                                      | mitigate    | `fetch().arrayBuffer()` will consume memory; worker is sandboxed so main thread keeps 60fps. `createImageBitmap` will throw on unparseable formats → caught → `excluded/decode-failed`. Worst case: worker OOMs and is restarted (browser behaviour). Acceptable for v1.                                                        |
| T-02-05-04 | Tampering              | PNG metadata `Record<string, string>` injected into `postMessage`    | mitigate    | Typed as plain strings at the boundary (`Record<string, string>`). The IDB repository stores as `Readonly<Record<string, string>>`. Phase 3 filter will treat as opaque strings. No `eval`, no `innerHTML` — the metadata never crosses into the DOM unsafely.                                                                  |
| T-02-05-05 | Spoofing               | Worker processes responses from the wrong filter generation          | mitigate    | `filterId` round-trip guard: every outgoing message echoes `filterId`; the bridge drops stale messages (implemented in Plan 06).                                                                                                                                                                                                |
| T-02-05-06 | Repudiation            | Silent cancellation on abort leaves no trail                         | accept      | Cancelled work is intentionally silent per D-06. Logging every abort would flood `console.warn` at the 5k scale.                                                                                                                                                                                                                |

</threat_model>

<verification>
- `pnpm test:unit --run src/platform/moshpit/services/thumbWorker.test.ts` — 5 tests PASS
- `pnpm typecheck` exits 0
- `pnpm lint` on the new files exits 0
- No new imports of `vue` / `pinia` / `@/components` in either file
</verification>

<success_criteria>

- Pure `processAsset` handler unit-tested with 5 cases (happy path, client-hash fallback, no-metadata, fetch-failed, abort-short-circuit)
- Worker shell wires `self.onmessage` with concurrency cap 4 and abort map
- Worker-safe imports only
- Discriminated union message contract shared with main thread
  </success_criteria>

<output>
Create `.planning/phases/02-asset-pipeline/02-05-SUMMARY.md` noting the worker-side vs main-thread abort semantics and any deviations from the message contract.
</output>
