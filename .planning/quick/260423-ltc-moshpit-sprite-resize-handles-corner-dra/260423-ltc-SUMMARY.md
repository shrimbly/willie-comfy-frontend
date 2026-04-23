---
phase: 260423-ltc
plan: 01
subsystem: moshpit
tags: [moshpit, pixi, pinia, sprite-layer, resize, pointer-events, overrides]
dependency-graph:
  requires:
    - 260423-j4f (moshpitOverrideStore + sprite layer overrides)
    - 260423-kdv (drag-to-pin composable + pointer precedence chain)
  provides:
    - src/platform/moshpit/composables/useMoshpitSpriteResize.ts (resize gesture)
    - src/platform/moshpit/composables/useMoshpitSpriteLayer.ts (cornerHitTest, hitTestHandle)
  affects:
    - MoshpitView pointer precedence chain (resize → drag → marquee → click)
    - SpriteHitTester interface (added hitTestHandle)
tech-stack:
  added: []
  patterns:
    - 'pointer-gesture composable (mirror of useMoshpitSpriteDrag)'
    - 'existing-watcher extension (no new watchEffect added)'
    - 'snapshot-restore on Escape / pointercancel'
key-files:
  created:
    - src/platform/moshpit/composables/useMoshpitSpriteResize.ts
    - src/platform/moshpit/composables/useMoshpitSpriteResize.test.ts
  modified:
    - src/platform/moshpit/composables/useMoshpitSpriteLayer.ts
    - src/platform/moshpit/composables/useMoshpitSpriteLayer.test.ts
    - src/platform/moshpit/composables/useMoshpitViewportInjection.ts
    - src/platform/moshpit/components/MoshpitCanvas.vue
    - src/platform/moshpit/components/MoshpitSpriteContextMenu.test.ts
    - src/platform/moshpit/composables/useMoshpitSpriteActions.test.ts
    - src/platform/moshpit/composables/useMoshpitSpriteDrag.test.ts
    - src/views/MoshpitView.vue
decisions:
  - 'Resize gesture engages BEFORE drag-to-pin in onContainerPointerDown. Hitting a corner handle always resizes; off-handle pointers fall through unchanged.'
  - "Handle visuals piggyback on the EXISTING stopSelectionEffect watchEffect — no new watcher added (honouring useMoshpitSpriteLayer's reactivity contract)."
  - 'cornerHitTest is a pure helper accepting a structural {x,y,width,height} shape so happy-dom tests can exercise it without Pixi.'
  - 'Pre-existing SpriteHitTester mocks (drag, sprite-actions, context-menu tests) had to be extended inline to satisfy the widened interface — Rule 3 blocker fix.'
metrics:
  duration: ~10 min
  completed: 2026-04-23
---

# Phase 260423-ltc: Moshpit Sprite Resize Handles Summary

Four-corner resize handles render on a single-selected sprite; dragging a corner
uniformly scales the sprite via `moshpitOverrideStore.setScale` with `[0.25, 5]`
clamping, epsilon-clear on release near 1×, and full Escape / pointercancel /
unmount restore. Resize takes precedence over drag-to-pin in the pointer chain.

## Tasks Completed

| Task | Name                                                    | Commit      | Files                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Extend sprite layer with resize handles + hitTestHandle | `d83dec592` | useMoshpitSpriteLayer.ts, useMoshpitSpriteLayer.test.ts, useMoshpitViewportInjection.ts, MoshpitCanvas.vue, MoshpitSpriteContextMenu.test.ts, useMoshpitSpriteActions.test.ts, useMoshpitSpriteDrag.test.ts |
| 2    | Create useMoshpitSpriteResize composable + tests        | `5915f39f3` | useMoshpitSpriteResize.ts, useMoshpitSpriteResize.test.ts                                                                                                                                                   |
| 3    | Wire resize precedence into MoshpitView pointer chain   | `f49078a2d` | MoshpitView.vue                                                                                                                                                                                             |

## Verification

- `pnpm test:unit` touched files: **80 / 80 passed** (layer: 22, resize: 18, drag: 18, actions: 13, context-menu: 9)
- `pnpm typecheck` — clean
- Husky pre-commit hook green on each commit (no `--no-verify`)

## Behavioural Coverage

**`cornerHitTest` (8 new tests):** hit each of 4 corners, miss at centre, miss
outside AABB, miss at edge midpoint, exact hit-box boundary (inside vs outside
at the ±halfSize edge), aspect-independent handle size on a non-square sprite.

**`useMoshpitSpriteResize` (18 tests):**

- engage on handle hit / no modifiers
- no-engage on handle null / button != 0 / any of Ctrl / Meta / Shift / Alt
- viewport pause-once + resume-once lifecycle
- pointermove writes `setScale(hash, startScale × dist / startDist)` — verified with a 2× ratio geometry
- clamp to `[0.25, 5]` — saturates at extremes
- pointerup near 1 (±0.01) → `clearScale(hash)`
- pointerup outside epsilon → final `setScale` persists
- Escape restores (clears vs re-sets) based on pre-resize snapshot
- pointercancel restores + resumes viewport
- unmount mid-resize resumes viewport + ignores subsequent moves
- zero-distance degenerate engage returns false (no crash, no store write)
- `getSpriteWorldPos == null` → refuse to engage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Pre-existing SpriteHitTester mocks missing `hitTestHandle`**

- **Found during:** Task 1 typecheck
- **Issue:** Widening `SpriteHitTester` with `hitTestHandle` broke four existing
  test files that hand-roll minimal mocks (`MoshpitSpriteContextMenu.test.ts`,
  `useMoshpitSpriteActions.test.ts`, `useMoshpitSpriteDrag.test.ts`).
- **Fix:** Added `hitTestHandle: vi.fn(() => null)` (or typed equivalent) to
  each mock. Rule 3 — blocks Task 1 from committing otherwise.
- **Files modified:** three existing test files (above)
- **Commit:** `d83dec592` (same as Task 1)

**2. [Rule 3 - Blocker] `hitTestHandle` wiring in `MoshpitCanvas.vue` moved into Task 1 commit**

- **Found during:** Task 1 typecheck
- **Issue:** Interface widening required `spriteHitTestRef.value = { …, hitTestHandle }`
  for `pnpm typecheck` to pass before Task 1 could commit. The plan had this
  single assignment line as "Task 3, Step 1", but that creates a broken
  intermediate state after Task 1.
- **Fix:** Folded the one-line wire into the Task 1 commit; Task 3 reduced to
  the MoshpitView precedence-chain changes (still a separate commit, per plan
  intent).
- **Commit:** `d83dec592` (sprite-layer commit)

## Known Stubs

None — feature is fully wired end-to-end: layer draws handles, composable drives
the gesture, MoshpitView routes the pointer. Manual smoke test path documented
in the plan's `<done>` Task 3 block is ready to exercise.

## Self-Check: PASSED

- Files created: confirmed
  - `src/platform/moshpit/composables/useMoshpitSpriteResize.ts` — FOUND
  - `src/platform/moshpit/composables/useMoshpitSpriteResize.test.ts` — FOUND
- Commits verified in `git log`:
  - `d83dec592` — FOUND
  - `5915f39f3` — FOUND
  - `f49078a2d` — FOUND
