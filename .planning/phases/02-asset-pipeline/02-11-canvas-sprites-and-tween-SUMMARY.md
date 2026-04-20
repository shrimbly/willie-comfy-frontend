---
plan: 02-11
phase: 02-asset-pipeline
status: complete
tasks_completed: 3
tasks_total: 3
checkpoint_resolution: deferred_to_phase_3
completed: '2026-04-21T05:30:00Z'
---

# Plan 02-11: Canvas Sprites and Tween — SUMMARY

## What was built

PixiJS sprite layer wired under the Moshpit viewport. Reactive `AssetEntry[]` from `useMoshpitAssetRegistry` drives sprite add/remove. On processing completion, sprites tween from jittered grid → packed grid over 300ms ease-out-cubic via the app Ticker.

### Files
- `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` — new, 224 lines. Owns the sprite `Container`, `Map<contentHash, Sprite>`, and the re-pack tween. `watchEffect` so progressive thumb arrival triggers sync (Blocker 2 guard).
- `src/platform/moshpit/composables/useMoshpitProcessingQueue.ts` — added `MOSHPIT_QUEUE_INJECTION_KEY: InjectionKey<ProcessingQueueState>` and tightened contract docs (Blocker 1 guard — single queue owner).
- `src/views/layouts/MoshpitLayout.vue` — `provide(MOSHPIT_QUEUE_INJECTION_KEY, queue)` so MoshpitCanvas can inject the single queue instance without prop-drilling through MoshpitView.
- `src/platform/moshpit/components/MoshpitCanvas.vue` — `inject(MOSHPIT_QUEUE_INJECTION_KEY)` + `useMoshpitSpriteLayer({ viewport, ticker: app.ticker, queue })` after viewport init. Sprite layer destroyed before `app.destroy` in `onBeforeUnmount`.
- `src/platform/moshpit/components/MoshpitCanvas.test.ts` — fakeQueue + inject mock to keep Phase 1 tests green.

### Key design decisions
- **Provide/inject over prop-drilling** — `MoshpitView` has its own marquee + sidebar logic that made prop threading awkward. The injection key is explicit and documented.
- **`watchEffect` (not `watch` on length)** — thumbReady events often don't change asset count; reading `entry.thumbUrl` inside the callback captures `thumbStore.urlByHash` reactivity so sprites appear as thumbs land.
- **Texture config** — `autoGenerateMipmaps: true`, `autoGarbageCollect: true`, container `cullable: true`. Matches plan intent for far-zoom LOD and off-screen sprite skip.
- **Re-pack fires once per completion** — `hasRepacked` flag resets when `complete` flips back to `false`; `complete` is computed from `queue.total > 0 && queue.done === queue.total`.

### Commits
- `4d5541e40` feat(02-11): implement useMoshpitSpriteLayer composable
- `1afd1fdeb` feat(02-11): wire sprite layer into canvas via provide/inject queue

## Test evidence

- 84/84 moshpit unit tests green (contentHash 4, layoutMath 3, thumbRepository 3, thumbWorker 5, workerBridge 4, stores 10, composables 4, components 11, plus Phase 1 tests)
- No new typecheck errors in touched files
- Lint clean

## Checkpoint resolution — task 3 (human verification)

The plan's task 3 is a visual walkthrough (progressive sprite arrival, 60fps pan/zoom, re-pack tween smoothness, warm-cache D-08, cancel/resume). **This cannot be walked from the Phase 2 UI** because no surface calls `queue.setFilter()` — that's Phase 3's filter gate.

The six checklist items have been persisted as `02-HUMAN-UAT.md` so they surface in `/gsd-progress` and `/gsd-audit-uat`. They'll be verified against the Phase 3 filter-gate implementation.

This matches the deferral pattern 02-12's VALIDATION.md already set up: the three `@moshpit` Playwright scenarios are `test.skip` pending the same Phase 3 filter gate.

## Follow-ups for Phase 3

- First filter-gate plan must call `queue.setFilter(filterKey, assets)` on entry and on filter change.
- Phase 3 verification should drive the 02-HUMAN-UAT checklist to completion and unskip the three 02-12 Playwright scenarios.
