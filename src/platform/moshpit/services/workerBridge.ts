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

export function createWorkerBridge(options?: CreateBridgeOptions): WorkerBridge {
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
    // Stale-filter guard (RESEARCH §6): drop messages from expired filter runs.
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
        curation: defaultCuration(),
        params: msg.params
      })
    } catch (err) {
      // IDB write failure: log but do not fire callback — UI stays in
      // "processing" state (consistent with T-02-06-04 mitigation).
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
