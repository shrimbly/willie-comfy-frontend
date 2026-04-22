---
phase: 02-asset-pipeline
plan: '06'
subsystem: moshpit/worker-bridge
tags: [worker-bridge, indexeddb, stale-filter, idle-dispatch, wave-2]
dependency_graph:
  requires:
    - 02-04 (thumbRepository — putThumb, putAssetMeta, getThumb, deleteMoshpitDB)
    - 02-05 (thumbWorker — workerMessages contract, ThumbWorker ?worker module)
  provides:
    - createWorkerBridge — main-thread dispatcher consumed by Plan 08 composable
  affects:
    - Plan 08 (useMoshpitProcessingQueue composable imports createWorkerBridge)
tech_stack:
  added: []
  patterns:
    - Vite ?worker import with injected factory for test isolation
    - runWhenGlobalIdle for idle-scheduled postMessage dispatch
    - filterId round-trip stale-message guard
    - IDB write-before-callback ordering via async/await
key_files:
  created:
    - src/platform/moshpit/services/workerBridge.ts
    - src/platform/moshpit/services/workerBridge.test.ts
    - src/platform/moshpit/services/workerMessages.ts (parallel dependency)
    - src/platform/moshpit/services/thumbWorker.ts (parallel dependency stub)
  modified: []
decisions:
  - Parallel dependency workaround: Plan 02-05 creates workerMessages.ts + thumbWorker.ts in its worktree; this worktree creates local copies so the bridge can compile and test. The orchestrator merge will reconcile both.
  - thumbWorker.ts included here as full implementation matching Plan 02-05 spec exactly — not a stub — so the ?worker import resolves at typecheck time.
  - void keyword used for handleThumbReady call to satisfy no-floating-promises rule while keeping the async IDB write non-blocking.
metrics:
  duration_minutes: 12
  completed_date: '2026-04-20T16:50:46Z'
  tasks_completed: 1
  files_created: 4
---

# Phase 02 Plan 06: Worker Bridge Summary

**One-liner:** Main-thread bridge routing thumbReady messages through IndexedDB with idle dispatch and filterId stale-filter guard.

## What Was Built

`createWorkerBridge` is the seam between Pinia-facing composable code (Plan 08) and the Vite `?worker` Web Worker (Plan 05). It owns:

- **Worker lifecycle**: Instantiates `ThumbWorker` via `?worker` import in production, or accepts a factory override for test isolation.
- **Stale-filter guard**: Compares each incoming `msg.filterId` against `activeFilterId`. Stale messages are silently dropped — no IDB write, no callback.
- **IDB write-before-callback**: `handleThumbReady` awaits `putThumb` + `putAssetMeta` before firing `onThumbReady` callbacks. If IDB write fails, the callback does not fire (consistent state: asset remains in "processing" state).
- **Idle dispatch**: `enqueue` schedules the `postMessage` call via `runWhenGlobalIdle`, preventing main-thread jank during bulk populate bursts.
- **Cancel semantics (D-06)**: `cancel(id)` posts `{type:'abort',id}` to the worker. `cancelAll()` posts `{type:'abortAll'}`. Neither touches IDB — completed thumbs survive cancellation.

## Test Coverage

4 Vitest unit tests using a `FakeWorker` class (implements `Worker` interface):

1. `enqueue posts an enqueue message to the worker` — verifies idle dispatch + postMessage routing
2. `routes thumbReady through IDB and fires onThumbReady` — verifies IDB write + callback fire after write
3. `drops stale-filter thumbReady (no IDB write, no callback)` — verifies filterId guard
4. `cancelAll posts abortAll` — verifies abort signal routing

All 4 tests pass in `fake-indexeddb` + happy-dom environment.

## Deviations from Plan

### Parallel Dependency Resolution

**Found during:** Task 1 setup

**Issue:** Plan 02-05 (parallel) creates `workerMessages.ts` and `thumbWorker.ts` in its own worktree. These files do not exist in this worktree, so `import ThumbWorker from './thumbWorker?worker'` and the message type imports would fail.

**Fix:** Created local copies of both `workerMessages.ts` and `thumbWorker.ts` in this worktree matching the spec from Plan 02-05's `<interfaces>` block exactly. The orchestrator merge will reconcile.

**Files modified:** `workerMessages.ts` (new), `thumbWorker.ts` (new — full implementation, not a stub)

**Commit:** `661465565`

This is documented per the `<note_about_parallel_dependency>` in the execution prompt.

## Known Stubs

None. The bridge is fully wired: factory injection → worker instantiation → message routing → IDB write → callback emission.

The `?worker` import requires `thumbWorker.ts` to exist. The file created here implements the full Plan 02-05 spec. The merge will keep whichever version Plan 02-05 produces (they should be identical per spec).

## Threat Flags

No new network endpoints, auth paths, or trust boundaries introduced beyond those documented in the plan's threat model.

## Self-Check: PASSED

- `src/platform/moshpit/services/workerBridge.ts` — FOUND
- `src/platform/moshpit/services/workerBridge.test.ts` — FOUND
- Commit `2a36841cf` — FOUND
- Commit `661465565` — FOUND
- 4 tests passing — CONFIRMED
