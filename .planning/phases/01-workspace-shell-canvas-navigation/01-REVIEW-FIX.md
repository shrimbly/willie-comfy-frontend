---
phase: 01-workspace-shell-canvas-navigation
fixed_at: 2026-04-20T00:00:00Z
review_path: .planning/phases/01-workspace-shell-canvas-navigation/01-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-20
**Source review:** `.planning/phases/01-workspace-shell-canvas-navigation/01-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 6 (WR-01 through WR-06; no Critical findings)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### WR-01: Async onMounted leaks PixiJS resources if component unmounts before init resolves

**Files modified:** `src/platform/moshpit/components/MoshpitCanvas.vue`
**Commit:** 2e595eb5b (combined with WR-06)
**Applied fix:** Introduced a module-scope `cancelled` flag. `onMounted` now constructs a local `pending` Application, awaits `init()`, and if `cancelled` is true after the await it destroys `pending` and returns early without appending the canvas, attaching the viewport, or starting the RAF loop. `onBeforeUnmount` sets `cancelled = true` up front and the RAF `tick` checks `cancelled` before re-arming so a late scheduled frame cannot resurrect the loop. **Requires human verification** (logic-level lifecycle change — confirm init-race path is exercised in tests or manual nav).

### WR-02: useMoshpitMarquee leaks document-level listeners on unmount during drag

**Files modified:** `src/platform/moshpit/composables/useMoshpitMarquee.ts`
**Commit:** 28dba2bf3 (combined with WR-03)
**Applied fix:** Added `onBeforeUnmount(() => cancel())` so document-level `pointermove`/`pointerup` listeners are torn down when the host component unmounts mid-drag. `cancel()` already removes both listeners and resets local state, so reusing it keeps unmount semantics consistent with an explicit drag cancellation.

### WR-03: Duplicate pointer-listener registration if onPointerDown fires twice without pointerup

**Files modified:** `src/platform/moshpit/composables/useMoshpitMarquee.ts`
**Commit:** 28dba2bf3 (combined with WR-02)
**Applied fix:** Added an early safety reset at the top of `onPointerDown`: if `isDragging.value || rect.value` is truthy, `cancel()` is invoked before recording a fresh start. Prevents the silent-drop-of-in-flight-drag symptom where `preDragSelection`, `startX`, `startY`, and `recordStart(e)` get overwritten while prior document listeners remain registered.

### WR-04: collapseOnFirstClick() fires on every pointer button, not just primary click

**Files modified:** `src/views/MoshpitView.vue`
**Commit:** f4bad7199
**Applied fix:** Gated `sidebarStore.collapseOnFirstClick()` behind `e.button === 0` in `onContainerPointerDown`, matching the button filter already used by the marquee composable. Right-click, middle-click, touch, and pen pointer-downs no longer silently collapse the settings panel. Container focus still runs unconditionally so keyboard focus follows any pointer interaction.

**Note:** REVIEW.md suggests adding an E2E test that right-clicks and asserts the panel stays visible. That test addition is out of scope for a code-fix pass; flagging for the verifier phase or a follow-up ticket.

### WR-05: Return value of useMoshpitCanvasInput is dead — composable is pure side-effect with a misleading API

**Files modified:** `src/platform/moshpit/composables/useMoshpitCanvasInput.ts`
**Commit:** ef238a7f5
**Applied fix:** Chose the lighter-touch option from the review (leave the navigator wiring in place, document its purpose). Added a multi-line `// TODO(phase-N)` comment above the `CanvasInputNavigator` literal explaining that pixi-viewport currently owns input and the dispatchers are intentional no-ops kept for API symmetry with the litegraph canvas path. Simplified the `dispatchWheel`/`dispatchPointer` bodies to empty arrow functions (their prior inline comments are now superseded by the block comment). Also incidentally addressed IN-04 by dropping the superfluous `?? false` on `spaceHeld.value` — `useMagicKeys().space` is `ComputedRef<boolean>`, never nullish.

Rationale for not renaming/removing the wrapper: the existing unit tests (`useMoshpitCanvasInput` is exercised via the test fixtures noted in REVIEW.md) depend on the current public shape, and the long-term intent per the review body is to route real input through the navigator once pixi-viewport is replaced. The TODO comment satisfies the over-engineering critique without churning tests.

### WR-06: Viewport teardown may double-destroy via pixi-viewport and Application.destroy

**Files modified:** `src/platform/moshpit/components/MoshpitCanvas.vue`
**Commit:** 2e595eb5b (combined with WR-01)
**Applied fix:** Removed the explicit `viewport.destroy({ children: true })` call from `onBeforeUnmount`, leaving only `app.destroy(true, { children: true, texture: true })` as the single owner of teardown (Pixi v8 cascades through the stage and tears the viewport down with it). The `viewport` reference is still nulled to break the closure. Also nulled `rafHandle` after `cancelAnimationFrame` and added an explanatory comment. **Requires human verification** on a real build to confirm pixi-viewport v6 is happy being destroyed via stage cascade (the review suggested cross-checking pixi-viewport docs if issues arise).

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-04-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
