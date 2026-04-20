---
phase: 01-workspace-shell-canvas-navigation
verified: 2026-04-20T00:00:00Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: 'User can pan with Space-drag, zoom with scroll/pinch, F fits the viewport, Z zooms to selection — behaviour is indistinguishable from the workflow canvas'
    status: partial
    reason: "Pan/zoom works via pixi-viewport native plugins but not through the shared useCanvasInput math. The CanvasInputNavigator dispatchWheel/dispatchPointer are intentional no-ops. handleWheel/handlePointer/forwardEvent are returned by useMoshpitCanvasInput but never attached to any DOM listener by the caller (MoshpitCanvas.vue calls useMoshpitCanvasInput without capturing the return value — WR-05). Space+drag does work (the watch() side-effect fires) but the claim of shared-math parity with litegraph is incorrect: pixi-viewport's built-in drag/wheel/pinch plugins handle input independently. F (FitView) and Z (ZoomToSelection, Phase 1 no-op) keybindings are wired. The 'indistinguishable' claim for SC-3/SHELL-03 is architecturally hollow for Phase 1."
    artifacts:
      - path: 'src/platform/moshpit/components/MoshpitCanvas.vue'
        issue: 'Line 56: useMoshpitCanvasInput(viewport, containerEl) — return value not captured; handleWheel/handlePointer/forwardEvent are dead'
      - path: 'src/platform/moshpit/composables/useMoshpitCanvasInput.ts'
        issue: 'dispatchWheel and dispatchPointer are explicit no-ops; useCanvasInput is wired but its output is never invoked on any event path'
    missing:
      - 'Either: capture and attach handleWheel/handlePointer from useMoshpitCanvasInput to the container/pixi canvas element, OR document explicitly that pixi-viewport plugins ARE the parity mechanism and SHELL-03 is satisfied by pixi-viewport configuration equivalence, not by useCanvasInput dispatch'
      - 'Clarify the SC-2 parity claim: useCanvasInput math is structurally present but functionally bypassed in the Moshpit path'
human_verification:
  - test: 'Navigate to /moshpit, hold Space, then left-click-drag'
    expected: 'Canvas pans in the dragged direction'
    why_human: 'Space+drag relies on a vue watch() side effect inside useMoshpitCanvasInput that reconfigures pixi-viewport.drag(). Cannot test pixi-viewport plugins in happy-dom unit tests.'
  - test: 'Navigate to /moshpit, scroll mouse wheel over canvas'
    expected: 'Canvas zooms in/out'
    why_human: 'pixi-viewport wheel plugin handles this natively; requires real browser + PixiJS renderer.'
  - test: 'Navigate to /moshpit, focus canvas, press F'
    expected: 'Viewport snaps to fitWorld()'
    why_human: 'Keybinding → store → RAF tick loop chain; requires real browser to verify full path fires.'
  - test: 'Run pnpm test:browser:local -- --grep @moshpit'
    expected: 'All 5 E2E specs pass: route mount, settings default-open, D-11 first-click collapse, D-11 re-open lock-out, SHELL-05 keep-alive round-trip'
    why_human: 'E2E specs were not run during verification; SHELL-05 proof requires a live ComfyUI backend serving the workflow graph.'
  - test: 'Navigate / -> /moshpit -> / and verify workflow graph nodes and _version are unchanged'
    expected: 'node count and _version match before and after the round-trip'
    why_human: 'keep-alive correctness requires a running app instance; cannot be verified statically.'
---

# Phase 01: Workspace Shell & Canvas Navigation Verification Report

**Phase Goal:** User can enter Moshpit as a peer workspace and pan/zoom/select on a full-bleed PixiJS canvas with pan/zoom parity matching the workflow canvas; Settings panel slot is mounted and behaves correctly.
**Verified:** 2026-04-20T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                     | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | User can open Moshpit as a top-level workspace (peer of the workflow graph) and the workflow graph is unchanged when they return to it                    | ✓ VERIFIED | `/moshpit` route exists as sibling in router.ts; `<keep-alive :include="['GraphView']">` in App.vue; `defineOptions({ name: 'GraphView' })` confirmed in GraphView.vue; SHELL-05 E2E spec exists and asserts `_version` unchanged (needs human run)                                                                                                                                                                          |
| 2   | User can pan with Space-drag, zoom with scroll/pinch, F fits the viewport, Z zooms to selection — behaviour is indistinguishable from the workflow canvas | ✗ PARTIAL  | pixi-viewport native plugins provide middle-mouse drag, wheel zoom, and pinch. Space+drag works via watch() side-effect. F/Z keybindings are registered and wired to store. However: `useCanvasInput` return value is not captured in MoshpitCanvas.vue (WR-05) — `handleWheel`/`handlePointer`/`forwardEvent` are never attached to any event; the "shared math" claim is architecturally present but functionally bypassed |
| 3   | User can multi-select with drag-rectangle marquee, Shift-click (add), Cmd/Ctrl-click (toggle), Cmd/Ctrl-A (select all visible), Esc (clear)               | ✓ VERIFIED | `useMoshpitMarquee` composable exists with modifier semantics (Shift/Ctrl/Meta); `useMoshpitCommands` provides SelectAll/ClearSelection; keybindings scoped to `moshpit-canvas-container` in defaults.ts; 12 marquee tests + 6 command tests pass                                                                                                                                                                            |
| 4   | Left Settings panel is open by default on workspace entry and auto-collapses on the first canvas interaction (pan/zoom/click)                             | ✓ VERIFIED | `moshpitSidebarStore` initialises `activePanelId = 'settings'`; `MoshpitLayout.vue` renders `<MoshpitSettingsPanel v-if="isSettingsOpen" />`; `collapseOnFirstClick()` wired in `MoshpitView.vue onContainerPointerDown`; D-11 `hasHadFirstInteraction` latch verified by 9 unit tests; NOTE: WR-04 found — no `e.button === 0` filter so right/middle-click also collapses (warning, not blocker for primary flow)          |

**Score: 3/4 truths verified** (SC-2 is partial due to WR-05 / hollow parity claim)

---

### Deferred Items

None. All phase 1 items are addressable within phase 1 scope.

---

### Required Artifacts

| Artifact                                                     | Provides                                         | Status     | Details                                                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/composables/canvas/useCanvasInput.ts`                   | Pure pan/zoom/marquee math composable            | ✓ VERIFIED | Exports `useCanvasInput` and `CanvasInputNavigator`; zero renderer imports; 12 tests pass                                                           |
| `src/composables/canvas/useCanvasInput.test.ts`              | Unit tests for pure composable (NAV-01..05)      | ✓ VERIFIED | 12 it() blocks present; all pass                                                                                                                    |
| `src/renderer/core/canvas/useCanvasInteractions.ts`          | Thin litegraph adapter over useCanvasInput       | ✓ VERIFIED | Imports and delegates to `useCanvasInput`; public shape preserved                                                                                   |
| `src/renderer/core/canvas/useCanvasInteractions.test.ts`     | Regression suite (24 cases)                      | ✓ VERIFIED | 24 tests (10 original + 14 new regression cases)                                                                                                    |
| `src/views/layouts/MoshpitLayout.vue`                        | Full-bleed sibling layout shell                  | ✓ VERIFIED | Flex layout with MoshpitSideRail + conditional MoshpitSettingsPanel + MoshpitView; no LayoutDefault chrome                                          |
| `src/views/MoshpitView.vue`                                  | Route component with `#moshpit-canvas-container` | ✓ VERIFIED | `id="moshpit-canvas-container"`, `tabindex="0"`, MoshpitCanvas mounted                                                                              |
| `src/router.ts`                                              | Top-level `/moshpit` route                       | ✓ VERIFIED | `{ path: '/moshpit', name: 'MoshpitView', component: () => import('@/views/layouts/MoshpitLayout.vue') }` present as sibling                        |
| `src/App.vue`                                                | keep-alive wrapping GraphView                    | ✓ VERIFIED | `<keep-alive :include="['GraphView']">` wraps router-view                                                                                           |
| `src/views/GraphView.vue`                                    | defineOptions name for keep-alive matching       | ✓ VERIFIED | `defineOptions({ name: 'GraphView' })` at line 35                                                                                                   |
| `src/platform/moshpit/stores/moshpitViewportStore.ts`        | Pinia viewport store                             | ✓ VERIFIED | Exports `useMoshpitViewportStore`; 9 tests pass                                                                                                     |
| `src/platform/moshpit/stores/moshpitSelectionStore.ts`       | Pinia selection store                            | ✓ VERIFIED | Exports `useMoshpitSelectionStore`; 10 tests pass                                                                                                   |
| `src/platform/moshpit/stores/moshpitSidebarStore.ts`         | Pinia sidebar store with D-11 latch              | ✓ VERIFIED | `hasHadFirstInteraction` latch present; 9 tests pass                                                                                                |
| `src/platform/moshpit/components/MoshpitCanvas.vue`          | PixiJS Application + Viewport lifecycle          | ✓ VERIFIED | mounts/destroys Pixi app; viewport syncs to store; RAF loop for imperatives                                                                         |
| `src/platform/moshpit/composables/useMoshpitCanvasInput.ts`  | Pixi adapter implementing CanvasInputNavigator   | ⚠️ PARTIAL | Exists and implements CanvasInputNavigator; Space+drag watch works; BUT dispatchWheel/dispatchPointer are no-ops and return value is unused (WR-05) |
| `src/platform/moshpit/composables/useMoshpitMarquee.ts`      | Screen-space marquee composable                  | ✓ VERIFIED | 12 tests; modifier semantics (Shift/Ctrl/Meta) verified                                                                                             |
| `src/platform/moshpit/components/MoshpitMarqueeOverlay.vue`  | Marquee rectangle overlay                        | ✓ VERIFIED | `data-testid="moshpit-marquee"` present                                                                                                             |
| `src/composables/useMoshpitCommands.ts`                      | 4 Moshpit canvas commands                        | ✓ VERIFIED | FitView/ZoomToSelection/SelectAll/ClearSelection; 6 tests pass                                                                                      |
| `src/platform/keybindings/defaults.ts`                       | F/Z/Ctrl+A/Esc scoped keybindings                | ✓ VERIFIED | 4 entries with `targetElementId: 'moshpit-canvas-container'` confirmed                                                                              |
| `src/platform/moshpit/components/MoshpitSideRail.vue`        | Left icon rail                                   | ✓ VERIFIED | `data-testid="moshpit-side-rail"` and `data-testid="moshpit-settings-tab"` present; togglePanel wired                                               |
| `src/platform/moshpit/components/MoshpitSettingsPanel.vue`   | Settings panel slot (empty Phase 1)              | ✓ VERIFIED | `data-testid="moshpit-settings-panel"` present                                                                                                      |
| `src/platform/moshpit/components/MoshpitSideRail.stories.ts` | Storybook stories for rail                       | ✓ VERIFIED | PanelOpen and PanelCollapsed stories present                                                                                                        |
| `src/views/layouts/MoshpitLayout.stories.ts`                 | Storybook story for full layout                  | ✓ VERIFIED | Default story present                                                                                                                               |
| `browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts`      | Playwright helper for moshpit container          | ✓ VERIFIED | File exists; targets `#moshpit-canvas-container`                                                                                                    |
| `browser_tests/tests/moshpit/moshpit-shell.spec.ts`          | @moshpit E2E spec (5 tests, SHELL-05 proof)      | ✓ VERIFIED | 5 tests tagged `@moshpit`; uses `comfyPageFixture as test`; SHELL-05 proof present (needs human run)                                                |

---

### Key Link Verification

| From                            | To                                         | Via                                   | Status      | Details                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------ | ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useCanvasInteractions.ts`      | `useCanvasInput.ts`                        | import + delegation                   | ✓ WIRED     | `import { useCanvasInput }` present; navigator construction verified                                                                                                       |
| `useMoshpitCanvasInput.ts`      | `useCanvasInput.ts`                        | import                                | ✓ WIRED     | Import present; navigator implemented                                                                                                                                      |
| `MoshpitCanvas.vue` (call site) | `useMoshpitCanvasInput` return value       | caller must capture and attach        | ✗ NOT_WIRED | `useMoshpitCanvasInput(viewport, containerEl)` called without capturing return — `handleWheel`/`handlePointer`/`forwardEvent` never attached to any event listener (WR-05) |
| `MoshpitCanvas.vue`             | `moshpitViewportStore`                     | store consumption for viewport sync   | ✓ WIRED     | `useMoshpitViewportStore()` consumed; setPan/setZoom/consumeFitView called                                                                                                 |
| `MoshpitView.vue`               | `MoshpitCanvas`                            | `<MoshpitCanvas :containerEl>`        | ✓ WIRED     | `<MoshpitCanvas v-if="containerEl" :containerEl="containerEl" />` present                                                                                                  |
| `App.vue`                       | `GraphView`                                | `<keep-alive :include=['GraphView']>` | ✓ WIRED     | Confirmed in App.vue template                                                                                                                                              |
| `router.ts`                     | `MoshpitLayout.vue`                        | sibling route at `/moshpit`           | ✓ WIRED     | Route present; lazy import confirmed                                                                                                                                       |
| `useMoshpitCommands.ts`         | `moshpitViewportStore`                     | calls requestFitView                  | ✓ WIRED     | `useMoshpitViewportStore().requestFitView()` in FitView command                                                                                                            |
| `useMoshpitCommands.ts`         | `moshpitSelectionStore`                    | calls selectAll / clear               | ✓ WIRED     | `useMoshpitSelectionStore().selectAll([])` and `.clear()` wired                                                                                                            |
| `defaults.ts`                   | `#moshpit-canvas-container`                | `targetElementId` scoping             | ✓ WIRED     | 4 keybindings confirmed with correct targetElementId                                                                                                                       |
| `MoshpitLayout.vue`             | `MoshpitSideRail.vue`                      | component mount `<MoshpitSideRail />` | ✓ WIRED     | Present in template                                                                                                                                                        |
| `MoshpitSideRail.vue`           | `moshpitSidebarStore`                      | `togglePanel('settings')`             | ✓ WIRED     | `sidebarStore.togglePanel(MOSHPIT_SETTINGS_PANEL_ID)` present                                                                                                              |
| `MoshpitView.vue`               | `moshpitSidebarStore.collapseOnFirstClick` | `onContainerPointerDown`              | ✓ WIRED     | Wired; note WR-04 — no button=0 filter                                                                                                                                     |

---

### Data-Flow Trace (Level 4)

| Artifact            | Data Variable     | Source                                                       | Produces Real Data                   | Status    |
| ------------------- | ----------------- | ------------------------------------------------------------ | ------------------------------------ | --------- |
| `MoshpitCanvas.vue` | viewport pan/zoom | pixi-viewport 'moved' event → `viewportStore.setPan/setZoom` | Yes — pixi-viewport fires live       | ✓ FLOWING |
| `MoshpitCanvas.vue` | pendingFitView    | `viewportStore.consumeFitView()` in RAF tick                 | Yes — store flag consumed each frame | ✓ FLOWING |
| `MoshpitView.vue`   | isDragging / rect | `useMoshpitMarquee` pointer events                           | Yes — pointer event driven           | ✓ FLOWING |
| `MoshpitLayout.vue` | isSettingsOpen    | `moshpitSidebarStore.activePanelId`                          | Yes — store reactive                 | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b is SKIPPED for the Pixi canvas and E2E behaviors — these require a running browser with a real PixiJS renderer and cannot be tested in the current non-server environment. Unit test checks confirm store and composable behaviors.

| Behavior                        | Command                                                                                        | Result                    | Status |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------- | ------ |
| Moshpit route exists in router  | `grep "path: '/moshpit'" src/router.ts`                                                        | found                     | ✓ PASS |
| keep-alive includes GraphView   | `grep "keep-alive.*GraphView" src/App.vue`                                                     | found                     | ✓ PASS |
| defineOptions name in GraphView | `grep "defineOptions.*GraphView" src/views/GraphView.vue`                                      | line 35                   | ✓ PASS |
| keybindings scoped to moshpit   | `grep -c "moshpit-canvas-container" src/platform/keybindings/defaults.ts`                      | 4                         | ✓ PASS |
| useCanvasInput return captured  | `grep "useMoshpitCanvasInput" src/platform/moshpit/components/MoshpitCanvas.vue`               | line 56 (uncaptured call) | ✗ FAIL |
| Space+drag watch side-effect    | `grep "viewport.plugins.remove" src/platform/moshpit/composables/useMoshpitCanvasInput.ts`     | found                     | ✓ PASS |
| pixi-viewport middle-mouse drag | `grep "mouseButtons: 'middle'" src/platform/moshpit/components/MoshpitCanvas.vue`              | line 51                   | ✓ PASS |
| SideRail data-testid present    | `grep "data-testid=\"moshpit-side-rail\"" src/platform/moshpit/components/MoshpitSideRail.vue` | found                     | ✓ PASS |
| E2E spec uses comfyPageFixture  | `grep "comfyPageFixture as test" browser_tests/tests/moshpit/moshpit-shell.spec.ts`            | found                     | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan  | Description                                                  | Status        | Evidence                                                                                                                   |
| ----------- | ------------ | ------------------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| SHELL-01    | 01-02        | Moshpit is a top-level workspace peer of the workflow graph  | ✓ SATISFIED   | `/moshpit` sibling route; MoshpitLayout not nested under LayoutDefault                                                     |
| SHELL-02    | 01-02, 01-03 | Full-bleed PixiJS canvas, no node-style chrome               | ✓ SATISFIED   | PixiJS Application mounted in `#moshpit-canvas-container`; no litegraph chrome in MoshpitLayout                            |
| SHELL-03    | 01-01, 01-03 | Shared input composable; parity with workflow canvas         | ✗ PARTIAL     | useCanvasInput is structurally shared but functionally bypassed (WR-05); pixi-viewport provides independent input handling |
| SHELL-04    | 01-05        | Settings panel open by default, auto-collapse, D-11 lock-out | ✓ SATISFIED   | Store initial state; v-if binding; collapseOnFirstClick wired; E2E spec tests all cases (needs human run)                  |
| SHELL-05    | 01-02, 01-05 | Workflow graph unchanged on exit                             | ? NEEDS HUMAN | keep-alive + defineOptions wiring verified statically; proof requires running SHELL-05 E2E spec                            |
| NAV-01      | 01-03        | Space-drag pan; scroll/pinch zoom                            | ✓ SATISFIED   | pixi-viewport drag/wheel/pinch plugins; Space+drag watch() side-effect active                                              |
| NAV-02      | 01-03, 01-04 | F fits viewport, Z zooms to selection                        | ✓ SATISFIED   | Keybindings wired; requestFitView() in RAF tick; Z is Phase 1 no-op with Phase 2 plumbing                                  |
| NAV-03      | 01-04        | Drag-rectangle marquee                                       | ✓ SATISFIED   | useMoshpitMarquee; MoshpitMarqueeOverlay wired; 12 tests pass                                                              |
| NAV-04      | 01-04        | Shift-add, Cmd/Ctrl-toggle in marquee                        | ✓ SATISFIED   | Modifier semantics in useMoshpitMarquee; tests verify Shift→addMany, Ctrl→XOR                                              |
| NAV-05      | 01-04        | Cmd/Ctrl+A select-all, Esc clear                             | ✓ SATISFIED   | SelectAll and ClearSelection keybindings scoped to container; commands wired to store actions                              |

---

### Anti-Patterns Found

| File                                                    | Line           | Pattern                                                                            | Severity   | Impact                                                                                                          |
| ------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| `src/platform/moshpit/components/MoshpitCanvas.vue`     | 56             | Return value of `useMoshpitCanvasInput` not captured                               | ⚠️ Warning | handleWheel/handlePointer/forwardEvent are never invoked; SC-2 "shared math" is structurally incomplete (WR-05) |
| `src/views/MoshpitView.vue`                             | 37             | `collapseOnFirstClick()` fires on all pointer buttons (no `e.button === 0` filter) | ⚠️ Warning | Right-click / middle-click also collapses panel, inconsistent with D-12 intent (WR-04)                          |
| `src/platform/moshpit/components/MoshpitCanvas.vue`     | 28-89          | Async onMounted: no cancelled-flag guard on app.init()                             | ⚠️ Warning | If component unmounts before init resolves, Pixi resources leak (WR-01)                                         |
| `src/platform/moshpit/composables/useMoshpitMarquee.ts` | 49-126         | document listeners not cleaned up on component unmount                             | ⚠️ Warning | Mid-drag navigation leaks pointermove/pointerup on document (WR-02)                                             |
| `src/composables/useMoshpitCommands.ts`                 | 27-32          | Commented-out Phase 2 code left in production source                               | ℹ️ Info    | Minor AGENTS.md violation; non-blocking (IN-01 from code review)                                                |
| `browser_tests/tests/moshpit/moshpit-shell.spec.ts`     | 56, 60, 71, 75 | `@ts-expect-error` × 4 for window.app globals                                      | ℹ️ Info    | Minor; typed cast would be cleaner (IN-02)                                                                      |

---

### Human Verification Required

#### 1. Space+drag pan on Moshpit canvas

**Test:** Navigate to `http://localhost:5173/moshpit`, focus canvas (click it), hold Space key, then left-click-drag.
**Expected:** Canvas pans in the dragged direction while Space is held; releases back to marquee mode when Space is released.
**Why human:** Space+drag relies on a `watch()` side effect inside `useMoshpitCanvasInput` that dynamically reconfigures `pixi-viewport.drag({ mouseButtons })`. Cannot test pixi-viewport plugin reconfiguration in happy-dom.

#### 2. Scroll/pinch zoom on Moshpit canvas

**Test:** Navigate to `/moshpit`, scroll mouse wheel over the canvas.
**Expected:** Canvas zooms in/out smoothly.
**Why human:** pixi-viewport `wheel` plugin handles this natively via the PixiJS renderer events system. Requires real browser with WebGL/Canvas2D renderer.

#### 3. F key fits viewport

**Test:** Navigate to `/moshpit`, click the canvas (gives it focus), press F.
**Expected:** Viewport snaps to fitWorld() — no visible change on an empty canvas, but the RAF tick loop should consume the `pendingFitView` flag.
**Why human:** Full keybinding → command → store → RAF → pixi-viewport chain; requires real browser.

#### 4. E2E spec suite

**Test:** Run `pnpm test:browser:local -- --grep @moshpit` against a running ComfyUI backend.
**Expected:** All 5 tests pass: (1) route mount, (2) settings default-open, (3) first-click auto-collapse, (4) re-open lock-out, (5) SHELL-05 keep-alive round-trip.
**Why human:** Browser tests require a live ComfyUI backend serving the default workflow. Cannot run in this static verification context.

#### 5. SHELL-05 keep-alive round-trip

**Test:** Open `/` with a loaded workflow, navigate to `/moshpit`, navigate back to `/`. Inspect `window.app.graph.nodes.length` and `window.app.graph._version` before and after.
**Expected:** Both values are identical before and after the round-trip.
**Why human:** Requires a running app instance with a real graph. The E2E spec covers this but must actually be executed.

---

### Gaps Summary

One gap blocks full goal achievement:

**Gap: SC-2 pan/zoom parity claim is structurally hollow (WR-05)**

The success criterion states pan/zoom behaviour is "indistinguishable from the workflow canvas" via a "shared input composable". The architecture sets this up correctly: `useCanvasInput` contains the shared math, `useMoshpitCanvasInput` implements `CanvasInputNavigator`, and the return value (`handleWheel`, `handlePointer`, `forwardEvent`) is returned. However, the consumer (`MoshpitCanvas.vue`, line 56) calls `useMoshpitCanvasInput(viewport, containerEl)` without assigning the return value. The three exported functions are never attached to any event listener.

The practical consequence is nuanced: pan/zoom still works — but through pixi-viewport's own native plugins, not through `useCanvasInput`'s math. The `dispatchWheel` and `dispatchPointer` methods on the navigator are intentional no-ops. The `useCanvasInput` import contributes nothing to actual input handling in the Moshpit path.

This means:

- Middle-mouse drag works (pixi-viewport `drag({ mouseButtons: 'middle' })` plugin)
- Scroll zoom works (pixi-viewport `wheel({ smooth: 3 })` plugin)
- Space+drag works (the `watch()` inside `useMoshpitCanvasInput` reconfigures the drag plugin — this side effect runs regardless of whether the return value is captured)
- F and Z keybindings work (store imperatives consumed in RAF loop)

What does NOT work as specified: the `useCanvasInput` math is not actually exercised on any Moshpit input event. SHELL-03 "behaviour is indistinguishable from the workflow canvas" is a UX claim that may still hold (user experience is similar), but the implementation does not achieve it through the shared composable as designed.

**Recommended resolution:** One of:

1. Capture the return value and attach `handleWheel`/`handlePointer` to the pixi canvas element DOM event listeners (fulfils the architectural contract)
2. Remove the `useCanvasInput` wiring from `useMoshpitCanvasInput` entirely (as WR-05 recommends), rename to `useMoshpitSpacePan`, and acknowledge that SHELL-03 is met via pixi-viewport configuration equivalence rather than code sharing

---

_Verified: 2026-04-20T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
