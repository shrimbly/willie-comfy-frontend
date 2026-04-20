---
status: testing
phase: 01-workspace-shell-canvas-navigation
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
  - 01-04-SUMMARY.md
  - 01-05-SUMMARY.md
started: 2026-04-20T00:00:00Z
updated: 2026-04-20T00:10:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
Kill any running frontend dev server. Run `pnpm dev` in /Users/willie/Documents/projects/comfy/ComfyUI_frontend. Dev server boots on http://localhost:5173 without errors. The root page loads the ComfyUI workflow graph. Ensure the ComfyUI backend is running on port 8188 (conda activate comfyui && python main.py). No uncaught exceptions in the browser console.
awaiting: user clarification before advancing

## Tests

### 1. Cold Start Smoke Test

expected: |
Run `pnpm dev`; http://localhost:5173 loads the workflow graph; ComfyUI backend running on :8188; no console errors on first paint.
result: issue
reported: "running frontend and backend, but page isn't loading; expected Electron app on 5173 with backend on 8188, can only see the BE interface, not the Electron app; see the ComfyUI loading screen but nothing loads. Console: user.css 404; legacy queue/history menu deprecation warning; pinia stores installed (moshpitSidebar, teamWorkspace, command, moshpitSelection, moshpitViewport); [Vue warn] onBeforeUnmount is called when there is no active component instance — make sure to register lifecycle hooks before the first await statement; moshpit:1 Unchecked runtime.lastError: Could not establish connection; user.css 404"
severity: blocker

### 2. Enter Moshpit Workspace

expected: |
Navigate to http://localhost:5173/moshpit (or via menu). Full-bleed layout renders with no LayoutDefault top menu. Left side rail (MoshpitSideRail) is visible. A full-bleed canvas area is present to the right. No console errors.
result: [pending]

### 3. Settings Panel Default-Open

expected: |
On first entry to /moshpit, the Settings panel (MoshpitSettingsPanel) is visible and expanded between the side rail and the canvas. The settings icon/tab in the side rail appears in an active/selected state.
result: [pending]

### 4. First-Click Auto-Collapse (D-11)

expected: |
Click anywhere on the empty canvas surface. The Settings panel collapses (hides). Side rail remains visible. This should happen on the FIRST primary (left) click only.
result: [pending]

### 5. D-11 Lock-Out Semantics

expected: |
After the auto-collapse from test 4, click the Settings tab in the side rail. Panel re-opens. Click the canvas again — panel collapses but does NOT auto-collapse on subsequent canvas clicks after manual re-open (the latch is permanent after first user collapse). Panel only opens/closes via explicit side-rail clicks after that.
result: [pending]

### 6. Space+Drag Pan

expected: |
Click the canvas to give it focus. Hold Space, then left-click-drag across the canvas. Viewport pans in the drag direction while Space is held. Release Space — drag reverts to marquee mode.
result: [pending]

### 7. Scroll/Wheel Zoom

expected: |
Mouse-wheel over the canvas. Canvas zooms in/out smoothly (pixi-viewport wheel plugin). Pinch zoom on trackpad also zooms.
result: [pending]

### 8. F Fits Viewport

expected: |
Click the canvas to focus, then press F. No errors. RAF tick consumes pendingFitView and viewport resets (no visible change on empty canvas, but no console noise). Pressing F repeatedly is idempotent.
result: [pending]

### 9. Marquee Drag Rectangle

expected: |
Left-click-drag across empty canvas (without Space). A dashed/translucent marquee rectangle overlay appears anchored at the pointer-down point and follows the cursor. Releasing clears the overlay.
result: [pending]

### 10. Esc Clears Selection

expected: |
With the canvas focused, press Esc. The selection store is cleared (observable via `useMoshpitSelectionStore().selected.size === 0` in devtools, or by attempting Cmd/Ctrl+A afterward and seeing selection rebuild).
result: [pending]

### 11. SHELL-05 Keep-Alive Round-Trip

expected: |
Open http://localhost:5173/ with the default workflow loaded. In DevTools console, note `window.app.graph.nodes.length` and `window.app.graph._version`. Navigate to /moshpit, then back to /. Re-check both values — they must be identical to the pre-round-trip values (workflow graph unchanged).
result: [pending]

### 12. @moshpit E2E Spec Suite

expected: |
Run `pnpm test:browser:local -- --grep @moshpit` against the running backend + frontend. All 5 moshpit-shell.spec.ts tests pass: route mount, settings default-open, D-11 first-click collapse, D-11 re-open lock-out, SHELL-05 keep-alive round-trip.
result: [pending]

## Summary

total: 12
passed: 0
issues: 1
pending: 11
skipped: 0
blocked: 0

## Gaps

<!-- Known pre-existing gap from VERIFICATION.md (WR-05 / SC-2) -->
<!-- Plan 01-06 has been drafted but not yet executed — closes this gap. -->

- truth: "App loads at http://localhost:5173 and shows the workflow graph (or Moshpit workspace) without staying stuck on the ComfyUI loading screen; no uncaught Vue warnings about lifecycle hooks in async setup"
  status: failed
  reason: "User reported: page stuck on ComfyUI loading screen; [Vue warn] onBeforeUnmount is called when there is no active component instance — lifecycle hooks must be registered before first await; Pinia moshpit stores did install; user.css 404 (benign) and runtime.lastError (browser extension, benign) also present"
  severity: blocker
  test: 1
  hypothesis: |
  Primary suspect: `useMoshpitCanvasInput` (src/platform/moshpit/composables/useMoshpitCanvasInput.ts)
  registers `onBeforeUnmount` and `watch` internally, but is called from MoshpitCanvas.vue line 64
  INSIDE `onMounted(async () => { ... })` AFTER `await pending.init()`. Lifecycle hooks registered
  post-await have no active instance context — this produces the observed Vue warning. Plan 01-06
  already addresses this by renaming to `useMoshpitSpacePan` and moving the composable call to
  the top of setup (synchronous), but 01-06 has not yet been executed.

  Secondary suspect: user may actually be on `/` (root GraphView, not /moshpit) and the loading
  screen is unrelated to Phase 1 code — need to confirm URL + whether pre-Phase-01 builds also
  hang on their machine.
  artifacts:
  - path: "src/platform/moshpit/composables/useMoshpitCanvasInput.ts"
    issue: "Registers onBeforeUnmount + watch; must be called synchronously in setup, not after await"
  - path: "src/platform/moshpit/components/MoshpitCanvas.vue"
    issue: "Line 64: useMoshpitCanvasInput(...) called AFTER `await pending.init()` in onMounted — lifecycle hooks lose their instance context"
    missing:
  - "Either execute plan 01-06 (renames + moves call site out of async onMounted), or as a minimal hotfix: move the useMoshpitCanvasInput() call to the top of <script setup> (synchronous), passing reactive refs for viewport/containerEl instead of imperative args"
  - "Confirm whether user is on / or /moshpit when the loading screen hangs — needed to tell whether this is the Phase 1 bug or a pre-existing root-page issue"
