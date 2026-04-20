---
phase: 02-asset-pipeline
plan: "05"
subsystem: moshpit/services
tags: [web-worker, offscreen-canvas, webp, discriminated-union, wave-2, leaf-module]
dependency_graph:
  requires:
    - src/platform/moshpit/services/contentHash.ts (sha256Hex — Wave 1 output)
    - src/scripts/metadata/png.ts (getFromPngBuffer — pre-existing)
  provides:
    - src/platform/moshpit/services/workerMessages.ts (WorkerInMessage, WorkerOutMessage, EnqueueAssetInput)
    - src/platform/moshpit/services/thumbWorker.ts (processAsset, self.onmessage worker shell)
  affects:
    - Plan 06 (workerBridge.ts — main-thread side that imports ?worker + workerMessages types)
    - Plan 08 (IDB writes after thumbReady via thumbRepository.putThumb)
tech_stack:
  added: []
  patterns:
    - "?worker Vite import pattern — first Web Worker module in the Moshpit pipeline"
    - "Discriminated union message contract (WorkerInMessage / WorkerOutMessage) — exhaustiveness via switch+never"
    - "Dependency-injected pure handler (processAsset + ProcessCtx) — testable without a real Worker"
    - "FIFO queue with AbortController per job + concurrency cap (WORKER_CONCURRENCY_CAP=4)"
    - "createImageBitmap resize + OffscreenCanvas.convertToBlob WebP encode path"
    - "Cloud fast-path: assetHash non-null/non-empty bypasses sha256Hex computation"
key_files:
  created:
    - src/platform/moshpit/services/workerMessages.ts
    - src/platform/moshpit/services/thumbWorker.ts
    - src/platform/moshpit/services/thumbWorker.test.ts
  modified: []
decisions:
  - "filterId echoed in all outgoing messages so workerBridge (Plan 06) can drop stale responses on filter change"
  - "Blob is structured-cloneable — no Transferable list passed; signature left open for future optimisation"
  - "processAsset ctx injection pattern: real encodeThumb/parseMetadata/hash injected by worker shell, mocked in tests"
  - "encodeThumbReal does two createImageBitmap calls — first to get source dimensions, second with resize options"
  - "AbortController propagates to fetch via signal; encodeThumb has no abort-signal API — silently returns early post-encode via aborted check"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
requirements: [ASSET-02, ASSET-05, ASSET-07]
---

# Phase 02 Plan 05: Thumb Worker Summary

One-liner: Web Worker + message contract for off-main-thread 512px WebP thumbnail generation with SHA-256 content hashing, metadata exclusion, and concurrency-capped AbortController propagation.

## What Was Built

### `src/platform/moshpit/services/workerMessages.ts`

Leaf-module discriminated union (58 lines, zero runtime imports):

| Export | Kind | Purpose |
|---|---|---|
| `EnqueueAssetInput` | interface | Per-asset work order posted to worker |
| `WorkerInMessage` | union | `enqueue` \| `abort` \| `abortAll` |
| `ThumbReadyMessage` | interface | Success result with blob + hash + metadata |
| `ExcludedMessage` | interface | Exclusion result with typed reason |
| `ErrorMessage` | interface | Unexpected error path |
| `WorkerOutMessage` | union | `ThumbReadyMessage` \| `ExcludedMessage` \| `ErrorMessage` |
| `THUMB_MAX_DIMENSION` | const | `512` |
| `WEBP_QUALITY` | const | `0.85` |
| `WORKER_CONCURRENCY_CAP` | const | `4` |

The discriminated union on `type` enables TypeScript exhaustiveness checking in any `switch` handler downstream.

### `src/platform/moshpit/services/thumbWorker.ts`

Two layers:

**Pure handler (`processAsset`)** — exported for unit testing via `ProcessCtx` injection:
1. Short-circuit if signal already aborted
2. `fetchFn(fetchUrl, { signal })` — AbortError returns silently; non-OK throws → `excluded/fetch-failed`
3. `parseMetadata(buffer)` — throws → `excluded/decode-failed`; empty result → `excluded/no-metadata`
4. `encodeThumb(buffer)` — throws → `excluded/decode-failed`
5. Content hash: `assetHash` when non-null/non-empty (cloud fast path); else `hash(buffer)` (client SHA-256)
6. `postMessage(thumbReady)` with blob, width, height, metadata, contentHash, id, filterId

**Worker shell** (`self.onmessage`):
- `enqueue`: pushes to queue, calls `schedule()`
- `abort`: aborts in-flight AbortController + splices matching queue entries
- `abortAll`: aborts all in-flight + clears queue
- `schedule()`: drains queue while `active < WORKER_CONCURRENCY_CAP`, creates AbortController per job, decrements `active` in `.finally()`

**`encodeThumbReal`**:
- Two `createImageBitmap` calls: first to measure dimensions, second to resize with `resizeQuality: 'high'`
- `OffscreenCanvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })`

### `src/platform/moshpit/services/thumbWorker.test.ts`

5 behavioural unit tests covering the pure `processAsset` handler:

| Test | Scenario |
|---|---|
| thumbReady with cloud hash | assetHash non-null → posted as contentHash, hash() not called |
| client-side hash fallback | assetHash null → hash() called, result in contentHash |
| excluded/no-metadata | parseMetadata returns {} → excluded posted, encodeThumb not called |
| excluded/fetch-failed | fetchFn returns ok:false → excluded posted |
| abort short-circuit | signal.aborted at entry → nothing posted, returns silently |

## Threat Mitigations Applied

| Threat | Mitigation in this plan |
|---|---|
| T-02-05-02 (zlib bomb) | `try/catch` around `ctx.parseMetadata(buffer)` → `excluded/decode-failed` |
| T-02-05-03 (large PNG OOM) | `createImageBitmap` throw caught → `excluded/decode-failed` |
| T-02-05-04 (metadata injection) | `Record<string, string>` type boundary; no eval/innerHTML |
| T-02-05-05 (stale filter) | `filterId` echoed in all outgoing messages |

T-02-05-01 (URL trust gate) is documented for Plan 06 workerBridge — only `getAssetUrl`-produced URLs may be posted.

## Worker-Side vs Main-Thread Abort Semantics

- **Worker-side**: AbortController is created per in-flight job by `schedule()`. The `abort` message finds the controller by job `id` and calls `.abort()`. The `AbortSignal` propagates to `fetch({ signal })` which throws `AbortError` → silently returns.
- **Main-thread abort** (Plan 06 responsibility): the bridge posts `{ type: 'abort', id }` or `{ type: 'abortAll' }` to the worker. The bridge also guards against stale `thumbReady` messages by comparing `filterId`.
- `createImageBitmap` does not accept an AbortSignal. The workaround is the `if (signal.aborted) return` checks after each await — if abort fires during the bitmap operation, the handler returns without posting.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- `src/platform/moshpit/services/workerMessages.ts` exists: FOUND
- `src/platform/moshpit/services/thumbWorker.ts` exists: FOUND
- `src/platform/moshpit/services/thumbWorker.test.ts` exists: FOUND
- Commit `53f3f1232` (workerMessages): FOUND
- Commit `bbc009674` (thumbWorker + tests): FOUND
- `grep "export type WorkerInMessage"`: MATCH
- `grep "export type WorkerOutMessage"`: MATCH
- `grep "export async function processAsset"`: MATCH
- `grep "self.onmessage"`: MATCH
- `grep -c "WORKER_CONCURRENCY_CAP"` (≥2): 3 matches
- 5 unit tests passing: CONFIRMED

## Self-Check: PASSED
