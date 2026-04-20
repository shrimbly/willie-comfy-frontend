---
phase: 02-asset-pipeline
plan: 06
type: execute
wave: 2
depends_on: ['02-04', '02-05']
files_modified:
  - src/platform/moshpit/services/workerBridge.ts
  - src/platform/moshpit/services/workerBridge.test.ts
autonomous: true
requirements: [ASSET-03, ASSET-07, ASSET-08]
tags: [worker-bridge, main-thread, wave-2]
must_haves:
  truths:
    - '`createWorkerBridge()` instantiates a Vite `?worker` import (`thumbWorker.ts?worker`) and exposes `enqueue`, `cancel`, `cancelAll`, `onThumbReady`, `onExcluded`, `onError`, `destroy`'
    - 'Bridge routes `thumbReady` messages to the IDB repository (`putThumb` + `putAssetMeta` via `thumbRepository`) and fires the `onThumbReady` callback AFTER the DB write completes'
    - 'Bridge drops stale messages whose `filterId` does not match the current active filter (RESEARCH §6 sequence guard)'
    - 'Bridge schedules worker enqueues via `runWhenGlobalIdle` so the main-thread dispatch loop does not jank interactions'
    - 'Bridge is factored so tests can inject a fake worker (MessageChannel-based) — the test file proves enqueue→IDB→callback round-trip'
  artifacts:
    - path: 'src/platform/moshpit/services/workerBridge.ts'
      provides: 'Main-thread dispatcher for the thumbnail worker'
      contains: 'export function createWorkerBridge'
    - path: 'src/platform/moshpit/services/workerBridge.test.ts'
      provides: 'Vitest coverage of enqueue routing, stale-filter rejection, and IDB write on thumbReady'
      contains: "describe('workerBridge"
  key_links:
    - from: 'src/platform/moshpit/services/workerBridge.ts'
      to: 'src/platform/moshpit/services/thumbWorker.ts'
      via: "import ThumbWorker from './thumbWorker?worker'"
      pattern: "import ThumbWorker from '\\./thumbWorker\\?worker'"
    - from: 'src/platform/moshpit/services/workerBridge.ts'
      to: 'src/platform/moshpit/services/thumbRepository.ts'
      via: 'putThumb / putAssetMeta after thumbReady'
      pattern: 'putThumb|putAssetMeta'
    - from: 'src/platform/moshpit/services/workerBridge.ts'
      to: 'src/base/common/async.ts'
      via: 'runWhenGlobalIdle dispatch'
      pattern: 'runWhenGlobalIdle'
---

<objective>
Build the main-thread bridge between the Pinia world and the Vite `?worker`. Responsibilities: instantiate the worker, dispatch enqueues during idle, route thumbReady messages through the IDB repository, drop stale-filter messages, propagate abort.

Purpose: Keep worker lifecycle + IDB writes + callback emission in one testable module. The composable (Plan 08) consumes this bridge without knowing about Worker APIs.

Output: One production file + one test file. ~180 LOC including tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-asset-pipeline/02-RESEARCH.md
@src/platform/moshpit/services/workerMessages.ts
@src/platform/moshpit/services/thumbRepository.ts
@src/base/common/async.ts

<interfaces>
Public API of `src/platform/moshpit/services/workerBridge.ts`:

```typescript
export interface WorkerBridge {
  /** Enqueue a thumbnail job. Returns immediately; result arrives via callbacks. */
  enqueue(input: EnqueueAssetInput): void
  /** Cancel a single in-flight or queued job by id. */
  cancel(id: string): void
  /** Cancel everything in the queue and abort in-flight work. */
  cancelAll(): void
  /** Set the active filter id; messages from stale filters are silently dropped. */
  setActiveFilterId(filterId: string): void
  /** Invoked after IDB write completes for the thumb + assetMeta. */
  onThumbReady(cb: (msg: ThumbReadyMessage) => void): () => void
  /** Invoked when an asset is excluded (no metadata, fetch-failed, decode-failed). */
  onExcluded(cb: (msg: ExcludedMessage) => void): () => void
  /** Invoked on unexpected worker errors. */
  onError(cb: (msg: ErrorMessage) => void): () => void
  /** Tear down the worker and release all callbacks. */
  destroy(): void
}

export interface CreateBridgeOptions {
  /** Override for tests — defaults to real ThumbWorker via `?worker` import. */
  readonly workerFactory?: () => Worker
}

export function createWorkerBridge(options?: CreateBridgeOptions): WorkerBridge
```

The factory override enables a MessageChannel-based fake worker in tests.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement workerBridge.ts with injected factory + IDB write routing</name>
  <read_first>
    - src/platform/moshpit/services/workerMessages.ts (message types)
    - src/platform/moshpit/services/thumbRepository.ts (putThumb + putAssetMeta + defaultCuration)
    - src/base/common/async.ts (runWhenGlobalIdle API)
    - .planning/phases/02-asset-pipeline/02-RESEARCH.md §6 Filter-Change-Mid-Processing (filterId stale-guard pattern)
    - .planning/phases/02-asset-pipeline/02-CONTEXT.md D-06 (cancel keeps completed thumbs — the bridge must NOT delete IDB rows on cancel)
  </read_first>
  <behavior>
    - createWorkerBridge with injected fake worker factory: returns a WorkerBridge whose `enqueue` posts `{type:'enqueue', input}` to the worker
    - When the fake worker posts `thumbReady`, the bridge calls putThumb + putAssetMeta, then invokes onThumbReady callbacks with the message
    - When filterId != activeFilterId, thumbReady is silently dropped (no IDB write, no callback)
    - cancelAll posts `{type:'abortAll'}` to the worker
    - destroy() calls `worker.terminate()` and clears callback arrays
  </behavior>
  <action>
Create `src/platform/moshpit/services/workerBridge.ts`:

```typescript
/**
 * Main-thread bridge between Pinia-facing code and the thumbnail Web Worker.
 *
 * Responsibilities:
 *  - Instantiate the Vite `?worker` module (or an injected fake in tests).
 *  - Route `thumbReady` messages through the IDB repository (putThumb +
 *    putAssetMeta) so persistence is the single source of truth. Callbacks
 *    fire only AFTER the IDB write completes.
 *  - Drop stale-filter messages using the `filterId` round-trip guard
 *    (RESEARCH §6). The bridge keeps `activeFilterId` and compares.
 *  - Dispatch enqueue `postMessage` during `runWhenGlobalIdle` so the main
 *    thread does not jank during a populate burst.
 *
 * Cancel semantics (D-06): `cancel` / `cancelAll` abort the worker queue but
 * DO NOT touch IDB. Completed thumbs remain cached and will be short-circuited
 * by the warm-cache path on re-entry (D-07).
 */

import { runWhenGlobalIdle } from '@/base/common/async'

// Vite `?worker` import — resolved at bundle time as a separate ES-module chunk.
import ThumbWorker from './thumbWorker?worker'
import { defaultCuration, putAssetMeta, putThumb } from './thumbRepository'
import type {
  EnqueueAssetInput,
  ErrorMessage,
  ExcludedMessage,
  ThumbReadyMessage,
  WorkerInMessage,
  WorkerOutMessage
} from './workerMessages'

export interface WorkerBridge {
  enqueue(input: EnqueueAssetInput): void
  cancel(id: string): void
  cancelAll(): void
  setActiveFilterId(filterId: string): void
  onThumbReady(cb: (msg: ThumbReadyMessage) => void): () => void
  onExcluded(cb: (msg: ExcludedMessage) => void): () => void
  onError(cb: (msg: ErrorMessage) => void): () => void
  destroy(): void
}

export interface CreateBridgeOptions {
  readonly workerFactory?: () => Worker
}

export function createWorkerBridge(
  options?: CreateBridgeOptions
): WorkerBridge {
  const worker: Worker = options?.workerFactory
    ? options.workerFactory()
    : new ThumbWorker()

  let activeFilterId = ''
  const thumbReadyCbs = new Set<(msg: ThumbReadyMessage) => void>()
  const excludedCbs = new Set<(msg: ExcludedMessage) => void>()
  const errorCbs = new Set<(msg: ErrorMessage) => void>()
  const idleDisposables: { dispose(): void }[] = []

  worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
    const msg = e.data
    // Stale-filter guard (RESEARCH §6)
    if (msg.filterId !== activeFilterId) return

    switch (msg.type) {
      case 'thumbReady':
        void handleThumbReady(msg)
        return
      case 'excluded':
        excludedCbs.forEach((cb) => cb(msg))
        return
      case 'error':
        errorCbs.forEach((cb) => cb(msg))
        return
      default: {
        const _exhaustive: never = msg
        void _exhaustive
      }
    }
  }

  worker.onerror = (ev) => {
    console.error('[moshpit] thumbWorker error', ev.message)
  }

  async function handleThumbReady(msg: ThumbReadyMessage): Promise<void> {
    try {
      await putThumb({
        contentHash: msg.contentHash,
        blob: msg.blob,
        width: msg.width,
        height: msg.height,
        generatedAt: Date.now()
      })
      await putAssetMeta({
        contentHash: msg.contentHash,
        metadata: msg.metadata,
        curation: defaultCuration()
      })
    } catch (err) {
      console.error('[moshpit] IDB write failed', err)
      return
    }
    thumbReadyCbs.forEach((cb) => cb(msg))
  }

  function post(msg: WorkerInMessage): void {
    worker.postMessage(msg)
  }

  return {
    enqueue(input) {
      const disposable = runWhenGlobalIdle(() => {
        post({ type: 'enqueue', input })
      })
      idleDisposables.push(disposable)
    },
    cancel(id) {
      post({ type: 'abort', id })
    },
    cancelAll() {
      post({ type: 'abortAll' })
    },
    setActiveFilterId(filterId) {
      activeFilterId = filterId
    },
    onThumbReady(cb) {
      thumbReadyCbs.add(cb)
      return () => thumbReadyCbs.delete(cb)
    },
    onExcluded(cb) {
      excludedCbs.add(cb)
      return () => excludedCbs.delete(cb)
    },
    onError(cb) {
      errorCbs.add(cb)
      return () => errorCbs.delete(cb)
    },
    destroy() {
      idleDisposables.forEach((d) => d.dispose())
      idleDisposables.length = 0
      thumbReadyCbs.clear()
      excludedCbs.clear()
      errorCbs.clear()
      worker.terminate()
    }
  }
}
```

Create `src/platform/moshpit/services/workerBridge.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createWorkerBridge } from './workerBridge'
import { deleteMoshpitDB, getThumb } from './thumbRepository'
import type { WorkerInMessage, WorkerOutMessage } from './workerMessages'

class FakeWorker implements Worker {
  public posted: WorkerInMessage[] = []
  public onmessage: ((ev: MessageEvent<WorkerOutMessage>) => void) | null = null
  public onerror: ((ev: ErrorEvent) => void) | null = null
  public onmessageerror: ((ev: MessageEvent) => void) | null = null
  postMessage(msg: WorkerInMessage): void {
    this.posted.push(msg)
  }
  terminate(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true
  }
  emit(msg: WorkerOutMessage): void {
    this.onmessage?.(new MessageEvent('message', { data: msg }))
  }
}

describe('workerBridge', () => {
  let fake: FakeWorker
  beforeEach(async () => {
    await deleteMoshpitDB()
    fake = new FakeWorker()
  })
  afterEach(async () => {
    await deleteMoshpitDB()
  })

  it('enqueue posts an enqueue message to the worker', async () => {
    const bridge = createWorkerBridge({ workerFactory: () => fake })
    bridge.setActiveFilterId('f1')
    bridge.enqueue({
      id: 'f1:a1',
      filterId: 'f1',
      fetchUrl: 'https://example.test/a.png',
      assetHash: 'H'
    })
    // Flush idle callback
    await new Promise((r) => setTimeout(r, 0))
    expect(fake.posted[0]?.type).toBe('enqueue')
    bridge.destroy()
  })

  it('routes thumbReady through IDB and fires onThumbReady', async () => {
    const bridge = createWorkerBridge({ workerFactory: () => fake })
    bridge.setActiveFilterId('f1')
    let received = 0
    bridge.onThumbReady(() => received++)
    fake.emit({
      type: 'thumbReady',
      id: 'f1:a1',
      filterId: 'f1',
      contentHash: 'H',
      blob: new Blob(['x'], { type: 'image/webp' }),
      width: 512,
      height: 512,
      metadata: { workflow: '{}' }
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(received).toBe(1)
    const cached = await getThumb('H')
    expect(cached?.contentHash).toBe('H')
    bridge.destroy()
  })

  it('drops stale-filter thumbReady (no IDB write, no callback)', async () => {
    const bridge = createWorkerBridge({ workerFactory: () => fake })
    bridge.setActiveFilterId('f2')
    let received = 0
    bridge.onThumbReady(() => received++)
    fake.emit({
      type: 'thumbReady',
      id: 'f1:a1',
      filterId: 'f1',
      contentHash: 'STALE',
      blob: new Blob(['x']),
      width: 512,
      height: 512,
      metadata: { workflow: '{}' }
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(received).toBe(0)
    expect(await getThumb('STALE')).toBeUndefined()
    bridge.destroy()
  })

  it('cancelAll posts abortAll', () => {
    const bridge = createWorkerBridge({ workerFactory: () => fake })
    bridge.setActiveFilterId('f1')
    bridge.cancelAll()
    expect(fake.posted.some((m) => m.type === 'abortAll')).toBe(true)
    bridge.destroy()
  })
})
```

Constraints:

- NO Pinia / Vue imports here — the bridge is consumed by the composable (Plan 08) which IS the Pinia-aware layer.
- NO `as any`.
- The `ThumbWorker?worker` import MUST be written literally — Vite resolves it at bundle time.
  </action>
  <verify>
  <automated>pnpm test:unit --run src/platform/moshpit/services/workerBridge.test.ts &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria> - `test -f src/platform/moshpit/services/workerBridge.ts` exits 0 - `test -f src/platform/moshpit/services/workerBridge.test.ts` exits 0 - `grep "import ThumbWorker from './thumbWorker?worker'" src/platform/moshpit/services/workerBridge.ts` returns a match - `grep "runWhenGlobalIdle" src/platform/moshpit/services/workerBridge.ts` returns at least one match - `grep "putThumb\|putAssetMeta" src/platform/moshpit/services/workerBridge.ts` returns at least 2 matches - `grep "msg.filterId !== activeFilterId" src/platform/moshpit/services/workerBridge.ts` returns a match (stale-guard) - `grep "as any\|: any\b" src/platform/moshpit/services/workerBridge.ts` returns zero matches - `pnpm test:unit --run src/platform/moshpit/services/workerBridge.test.ts` exits 0 with 4 tests passing - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Bridge instantiates real worker in prod, fake worker in tests; IDB writes precede callbacks; stale-filter dropping works.</done>
  </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                  | Description                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Pinia composable → bridge | Trusted (same origin, main thread)                                                    |
| Bridge → worker           | Trusted via `?worker` bundling — Vite guarantees same-origin worker                   |
| Bridge ← worker           | Messages are typed via discriminated union; exhaustiveness guard catches new variants |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                             | Disposition | Mitigation Plan                                                                                                                                                                                                              |
| ---------- | ---------------------- | ----------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-02-06-01 | Spoofing               | Stale-filter messages crossing filter changes         | mitigate    | `activeFilterId` gate drops any message whose `filterId` does not match. Tests cover the drop path.                                                                                                                          |
| T-02-06-02 | Information Disclosure | `getAssetUrl` must produce same-origin URLs           | mitigate    | Plan 08 composable is the caller; it always uses `getAssetUrl(asset)` from `@/platform/assets/utils/assetUrlUtil`. Documented as the sole sanctioned URL source in Plan 08.                                                  |
| T-02-06-03 | Denial of Service      | Callback storms from thousands of thumbReady messages | accept      | 5k cap per PROJECT.md; `forEach` over small callback sets (typically 1–2 consumers). Dispatcher naturally rate-limits via worker concurrency cap (Plan 05).                                                                  |
| T-02-06-04 | Tampering              | IDB write failure could silently drop thumbs          | mitigate    | `try/catch` around `putThumb`/`putAssetMeta` logs via `console.error`; the callback does NOT fire if IDB write fails, so the UI state stays consistent (the thumb shows up as still-processing, will retry on next session). |

</threat_model>

<verification>
- `pnpm test:unit --run src/platform/moshpit/services/workerBridge.test.ts` — 4 tests PASS
- `pnpm typecheck` exits 0
- Vite can resolve `./thumbWorker?worker` at build time (confirmed by typecheck + existing `?worker` support)
</verification>

<success_criteria>

- Factory-injected fake worker in tests; real `?worker` in production
- IDB write precedes callback emission
- Stale-filter guard works
- Idle-dispatched enqueues
  </success_criteria>

<output>
Create `.planning/phases/02-asset-pipeline/02-06-SUMMARY.md` noting that this plan establishes the `?worker` precedent for the repo.
</output>
