# Phase 1: Workspace Shell & Canvas Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 01-workspace-shell-canvas-navigation
**Areas discussed:** Workspace entry/exit, Layout integration, Shared-input composable strategy, Settings panel re-open affordance

---

## Workspace Entry/Exit

### Q: How should the user open Moshpit and return to the workflow graph?

| Option                    | Description                                                                                            | Selected |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| Route-based               | Dedicated `/moshpit` URL, LayoutDefault switches view; back-button / top-nav item returns to `/`.      | ✓        |
| Command + keyboard toggle | A `Workspace.ToggleMoshpit` command registered via commandStore with keyboard shortcut; no URL change. |          |
| Top menu item only        | Single menubar entry flips `appMode` / workspace state.                                                |          |
| All of the above          | Route + command (bound to keybinding) + menubar entry.                                                 |          |

**User's choice:** Route-based.

### Q: Which keyboard shortcut should toggle Moshpit (if any)?

| Option            | Description                      | Selected |
| ----------------- | -------------------------------- | -------- |
| No shortcut in v1 | Only menu / URL entry.           | ✓        |
| Cmd/Ctrl+Shift+M  | Mnemonic (M for Moshpit).        |          |
| You decide        | Claude picks a sensible default. |          |

**User's choice:** No shortcut in v1.

### Q: What state should Moshpit keep between entries?

| Option                 | Description                                                              | Selected |
| ---------------------- | ------------------------------------------------------------------------ | -------- |
| Viewport only          | Remember last pan/zoom; selection cleared; panel default-open.           |          |
| Full session state     | Viewport, selection, panel state across exits; IndexedDB across reloads. | ✓        |
| Clean slate each entry | Fresh viewport, selection, panel open every entry.                       |          |
| You decide             | Claude picks.                                                            |          |

**User's choice:** Full session state.
**Notes:** Cross-reload IndexedDB persistence may defer to Phase 2 when the IndexedDB store is stood up. Phase 1 owns the in-memory Pinia store.

---

## Layout Integration

### Q: How should Moshpit integrate with the existing LayoutDefault grid?

| Option                         | Description                                                                                             | Selected |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | -------- |
| Replace center cell only       | Moshpit mounts inside `#graph-canvas-container` via `v-if`; shared chrome. GraphCanvas `v-show`-hidden. |          |
| Full-screen overlay            | Moshpit covers the whole body when active, hiding LayoutDefault chrome entirely.                        |          |
| Separate route with own layout | Moshpit gets MoshpitLayout.vue, sibling to LayoutDefault in router.                                     | ✓        |

**User's choice:** Separate route with own layout.

### Q: Which chrome elements should MoshpitLayout share with LayoutDefault? (multi-select)

| Option                       | Description                       | Selected |
| ---------------------------- | --------------------------------- | -------- |
| Top menu bar (MenuHamburger) | Share File/Edit/View/Help.        | ✓        |
| Left sidebar (SideToolbar)   | Share the side toolbar icon rail. |          |
| Bottom panel                 | Share bottom panel (logs, queue). |          |
| Global toasts/dialogs        | GlobalToast, progress dialogs.    |          |

**User's choice:** Top menu bar only.

### Q: How should GraphCanvas be preserved across the route switch?

| Option                                 | Description                                                      | Selected |
| -------------------------------------- | ---------------------------------------------------------------- | -------- |
| keep-alive on GraphView                | `<keep-alive>` so GraphView stays mounted across route switches. | ✓        |
| Unmount and restore from workflowStore | Let GraphView unmount, re-mount and reload on return.            |          |
| You decide                             | Claude picks after verifying keep-alive + extensions.            |          |

**User's choice:** keep-alive on GraphView.

---

## Shared-Input Composable Strategy

### Q: How should pan/zoom/selection logic be shared between litegraph canvas and PixiJS Moshpit canvas?

| Option                         | Description                                                                                          | Selected |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | -------- |
| Extract pure input composable  | Refactor `useCanvasInput` as a primitive owning math on generic viewport state; both canvases adopt. | ✓        |
| Adapter interface              | Define `CanvasInputTarget`; litegraph + Pixi implement it.                                           |          |
| Parallel implementation for v1 | Copy useCanvasInteractions patterns into `useMoshpitCanvasInput`; no litegraph refactor.             |          |
| You decide                     | Claude evaluates coupling and Pixi APIs.                                                             |          |

**User's choice:** Extract pure input composable.

### Q: How strictly must the extraction preserve current litegraph canvas behavior?

| Option                                            | Description                                                                                           | Selected |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| Zero regressions — refactor behind a test harness | Add unit/e2e coverage pinning current pan/zoom/marquee behavior before extraction.                    | ✓        |
| Visual parity only                                | Extract and smoke-test manually; fix regressions during later dogfood.                                |          |
| Feature-flag the refactor                         | Ship extracted composable behind a setting; litegraph canvas stays on original path until flag flips. |          |

**User's choice:** Zero regressions — refactor behind a test harness.

### Q: For PixiJS viewport management, which approach?

| Option                                 | Description                                                        | Selected |
| -------------------------------------- | ------------------------------------------------------------------ | -------- |
| pixi-viewport plugin                   | Use the established plugin for pan/zoom/wheel/pinch.               | ✓        |
| Hand-rolled viewport on PIXI.Container | Apply pan/zoom transforms directly to a root Container.            |          |
| You decide                             | Claude picks after checking pixi-viewport + Pixi v8 compatibility. |          |

**User's choice:** pixi-viewport plugin.

---

## Settings Panel Re-open Affordance

### Q: After the Settings panel auto-collapses on first canvas interaction, how should the user re-open it?

| Option                      | Description                                                           | Selected |
| --------------------------- | --------------------------------------------------------------------- | -------- |
| Edge toggle button          | Persistent slim arrow/chevron on the left edge.                       |          |
| Keyboard shortcut only      | Shortcut toggles; no visual affordance.                               |          |
| Hover-to-peek, click-to-pin | Hovering left 8px strip shows collapsed preview; clicking pins.       |          |
| Floating gear button        | Small gear icon bottom-left of canvas.                                |          |
| Other (free text)           | "I want to have a left hand menu like we do on the node graph layout" | ✓        |

**User's choice:** Moshpit-specific left icon rail, same visual pattern as litegraph `SideToolbar`, Moshpit-specific icons/buttons. Confirmed via follow-up.

### Q: Should the auto-collapse rule ever re-fire after re-open?

| Option                                              | Description                                   | Selected |
| --------------------------------------------------- | --------------------------------------------- | -------- |
| No — once user re-opens, panel stays open           | Auto-collapse is first-entry onboarding only. | ✓        |
| Yes — re-collapse on every canvas interaction burst | Every pan/zoom re-closes.                     |          |
| Only re-collapse on comparison mode entry           | Panel auto-closes on compare/full-res view.   |          |
| You decide                                          | Claude picks.                                 |          |

**User's choice:** No — once re-opened, stays open.

### Q: Which canvas interactions count as 'first interaction' for the initial auto-collapse?

| Option                              | Description                                                                                                                                                                   | Selected |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Pan, zoom, or click on empty canvas | Matches SHELL-04 literal wording. Asset-click does NOT collapse.                                                                                                              |          |
| Any pointer/wheel event             | Pan, zoom, click anywhere including sprites.                                                                                                                                  |          |
| Only pan or zoom                    | Click alone doesn't collapse.                                                                                                                                                 |          |
| Other (free text)                   | "Let do a click outside the filter panel, panning, zooming are ok." → clarified to: click-outside-panel collapses; click on asset collapses; pan/zoom/scroll do NOT collapse. | ✓        |

**User's choice:** Clicks only (on empty canvas OR on an asset). Pan/zoom/scroll do not collapse the panel. **Explicit refinement of SHELL-04's literal wording.**

---

## Claude's Discretion

- Exact Pinia store shape for Moshpit viewport/selection state
- Router guard details for `/moshpit`
- Directory placement inside `src/platform/` (likely `src/platform/moshpit/`)
- Adapter interface shape for `useCanvasInput`
- Whether to reuse `sidebarTabStore` or stand up a parallel Moshpit tab store
- Test harness approach for pinning current litegraph pan/zoom/marquee
- `pixi-viewport` version and plugin knob defaults
- Whether Moshpit honors `Comfy.Canvas.NavigationMode` or is always standard-mode

## Deferred Ideas

- Keyboard shortcut for Moshpit toggle (post-v1)
- Cross-reload persistence via IndexedDB (Phase 2)
- Asset-click as a collapse trigger (Phase 2 extension)
- Toast mount point in MoshpitLayout (Phase 5)
- Empty-canvas validation strategy for Phase 1 (user skipped; planner/researcher decides)
- Figma design reference check for Moshpit-specific tokens
