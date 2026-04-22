---
status: partial
phase: 02-asset-pipeline
source: [02-11-canvas-sprites-and-tween-PLAN.md, 02-VALIDATION.md]
started: '2026-04-21T05:30:00Z'
updated: '2026-04-21T05:30:00Z'
verifiable_from: phase_3
---

## Current Test

[awaiting Phase 3 filter gate — no Phase 2 UI surface calls `queue.setFilter()`]

## Context

Phase 2 ships the full worker → IDB → sprite-layer pipeline. Visual verification of sprite arrival, re-pack tween, warm cache, and cancel/resume requires a filter trigger that Phase 2 intentionally does not implement (see 02-VALIDATION.md `nyquist_compliant: false` deferral block and the three `test.skip` scenarios in `browser_tests/tests/moshpit/asset-pipeline.spec.ts`).

When Phase 3 lands the filter gate, re-walk these items against a live backend.

## Setup

1. Start backend: `conda activate comfyui && cd /Users/willie/Documents/projects/comfy/ComfyUI && python main.py`
2. Start frontend: `pnpm dev`
3. Open the normal UI, click the Moshpit workspace button in the Media Assets sidebar header (or run `Moshpit.Workspace.Open` from the command palette).
4. Generate ~20–50 outputs via the workflow graph so `assetsStore.historyAssets` has real entries.
5. Return to `/moshpit`. Phase 3's filter gate must call `queue.setFilter(filterKey, assets)` for any sprite to render — verify that first.

## Tests

### 1. Sprites appear progressively (ASSET-02, Blocker 2 guard)

expected: Sprites pop in one-by-one as the worker emits `thumbReady`, not in a single batch at the end. The jittered-grid layout (`computeJitteredGrid`) places each at its slot immediately.
result: [pending — requires Phase 3 filter gate]

### 2. 60fps sustained during processing (performance budget)

expected: DevTools Performance panel shows no long frames (>16.67ms) during a 20-asset set. Pan/zoom remains smooth.
result: [pending — requires Phase 3 filter gate]

### 3. 300ms ease-out-cubic re-pack tween on completion (D-04, Blocker 1 guard)

expected: When `queue.done === queue.total > 0`, sprites glide from jittered positions to packed positions over exactly 300ms. Easing curve is `1 - (1 - t)^3`. Fires once per completion cycle.
result: [pending — requires Phase 3 filter gate]

### 4. Warm cache populates without processing pill (ASSET-10 / D-08)

expected: On page reload where every contentHash in the filter is already in IDB, `computeQueueDelta` returns empty, the bridge is never posted to, sprites pop in directly from cached `URL.createObjectURL`, and the processing pill does not appear.
result: [pending — requires Phase 3 filter gate]

### 5. Cancel mid-processing preserves completed thumbs (D-06, ASSET-08)

expected: Clicking the pill's cancel button: (a) aborts in-flight worker work via `bridge.cancelAll()`, (b) sets `total = done` so `isActive` flips false and the pill disappears, (c) preserves sprites for thumbs that already landed, (d) re-entering `/moshpit` with the same filter resumes processing for the remainder via D-07 auto-resume.
result: [pending — requires Phase 3 filter gate]

### 6. OSS-path assets render (AssetItem.asset_hash === null)

expected: Local-backend assets (no server-side hash) still appear as sprites. The worker computes the SHA-256 hash, the queue composable calls `metaStore.recordAssetHash(msg.assetId, msg.contentHash)`, and `useMoshpitAssetRegistry.entries` resolves the hash via the `asset_hash ?? assetIdToHash.get(a.id)` fallback.
result: [pending — requires Phase 3 filter gate]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

[none yet — all items pending]
