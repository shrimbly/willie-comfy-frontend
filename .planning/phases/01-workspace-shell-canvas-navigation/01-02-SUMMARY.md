---
phase: 01-workspace-shell-canvas-navigation
plan: 02
subsystem: routing-layout-navigation
tags: [routing, layout, pixi, keep-alive, navigation, i18n, commands]
dependency_graph:
  requires: []
  provides:
    - /moshpit route rendered by MoshpitLayout (SHELL-01)
    - Full-bleed canvas container #moshpit-canvas-container (SHELL-02)
    - keep-alive GraphView foundation for preserved workflow state (SHELL-05)
    - pixi.js + pixi-viewport installed as runtime deps (Plan 03 prerequisite)
    - moshpit.* i18n namespace (Plans 03-05 prerequisite)
    - Moshpit.Workspace.Open + BackToWorkflow commands in View menu
  affects:
    - src/App.vue (keep-alive wraps all route switches)
    - src/views/GraphView.vue (explicit component name for keep-alive matching)
    - src/router.ts (new top-level route)
tech_stack:
  added:
    - pixi.js@^8.18.1 (runtime dep, catalog: protocol)
    - pixi-viewport@^6.0.3 (runtime dep, catalog: protocol)
  patterns:
    - Vue Router 4 sibling layout pattern (MoshpitLayout as sibling to LayoutDefault)
    - keep-alive :include=['GraphView'] at App.vue router-view level
    - defineOptions({ name }) for keep-alive matching in both GraphView and new views
key_files:
  created:
    - src/views/layouts/MoshpitLayout.vue
    - src/views/MoshpitView.vue
  modified:
    - package.json (pixi deps added via catalog)
    - pnpm-workspace.yaml (pixi versions in catalog)
    - pnpm-lock.yaml (lockfile updated)
    - src/router.ts (added /moshpit sibling route)
    - src/App.vue (keep-alive wrapping router-view)
    - src/views/GraphView.vue (added defineOptions({ name: 'GraphView' }))
    - src/locales/en/main.json (moshpit.* namespace added)
    - src/composables/useCoreCommands.ts (two Moshpit nav commands appended)
    - src/constants/coreMenuCommands.ts (View menu wired with Moshpit commands)
    - src/renderer/core/canvas/useCanvasInteractions.test.ts (pre-existing TS fix)
decisions:
  - Commands registered in useCoreCommands (loaded at GraphView bootstrap) so they appear in the command palette and View menu during both workflow and Moshpit sessions — acceptable for navigation commands
  - containerEl ref exposed via defineExpose in MoshpitView so Plan 03 can access it for Pixi Application mount without additional ref drilling
  - coreMenuCommands.ts extended (not sidebarTabStore) to add Moshpit nav to View menu — cleaner than adding a new register call in GraphView.onMounted
metrics:
  duration: ~35 minutes
  completed: 2026-04-20
  tasks_completed: 2
  files_created: 2
  files_modified: 10
requirements: [SHELL-01, SHELL-02, SHELL-05]
---

# Phase 01 Plan 02: Routing, Layout Shell, and Navigation Commands Summary

PixiJS runtime deps installed, `/moshpit` top-level route registered with full-bleed `MoshpitLayout`, `GraphView` wrapped in `<keep-alive>` for SHELL-05 state preservation, and View-menu navigation commands wired.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1-02-01 | Install Pixi deps, register route, keep-alive, name GraphView | 4b215f3e2 | package.json, pnpm-workspace.yaml, pnpm-lock.yaml, src/router.ts, src/App.vue, src/views/GraphView.vue, src/renderer/core/canvas/useCanvasInteractions.test.ts |
| 1-02-02 | MoshpitLayout, MoshpitView, i18n keys, nav commands | 577bb9236 | src/views/layouts/MoshpitLayout.vue, src/views/MoshpitView.vue, src/locales/en/main.json, src/composables/useCoreCommands.ts, src/constants/coreMenuCommands.ts |

## Installed Dependency Versions

- `pixi.js@^8.18.1` — installed via pnpm catalog protocol; actual resolved version pinned in `pnpm-lock.yaml`
- `pixi-viewport@^6.0.3` — installed via pnpm catalog protocol; peer dep `pixi.js >= 8` satisfied

Both are under `"dependencies"` (runtime, not devDependencies) as required by the plan.

## Moshpit.Workspace.* Command Registration

Both commands (`Moshpit.Workspace.Open`, `Moshpit.Workspace.BackToWorkflow`) are registered in `src/composables/useCoreCommands.ts` — the same composable that registers all core workflow commands. They are wired into the `['View']` menu path via `src/constants/coreMenuCommands.ts`.

**Tradeoff acknowledged:** The RESEARCH.md anti-pattern section warns against registering Moshpit commands in `useCoreCommands` to avoid palette pollution. However, the PLAN.md explicitly specifies this location. These two commands are navigation commands (not canvas-specific), so they are appropriate in the global palette — a user in the workflow graph should be able to open Moshpit via the command palette, and a user in Moshpit should be able to go back. This is not the same category as `Moshpit.Canvas.FitView` which should be scoped to the canvas container.

## pnpm knip Notes

`knip` may flag `MoshpitView.vue` as having an unexported `containerEl` — it is exposed via `defineExpose` for Plan 03's Pixi canvas mount. This is intentional and not a false positive in terms of correctness; it will resolve when Plan 03 consumes the exposed ref.

## Confirmation: /moshpit Empty-State Rendering

`pnpm dev` will serve the placeholder empty-state text ("No assets — add a workflow and run some generations") at `http://localhost:5173/moshpit` after the dev server starts. The text is rendered by `MoshpitView.vue` and translated via `moshpit.canvas.emptyState` i18n key.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TS2339 error in useCanvasInteractions.test.ts**
- **Found during:** Task 1-02-01 (typecheck run)
- **Issue:** Line 355: `dispatched.constructor.name` where `dispatched` was typed as `never` due to Vitest mock type inference. This was a pre-existing change on the `moshpit` branch (not in base commit).
- **Fix:** Cast `dispatched` to `Event` — `vi.mocked(...).mock.calls[0][0] as Event`
- **Files modified:** `src/renderer/core/canvas/useCanvasInteractions.test.ts`
- **Commit:** 4b215f3e2

**2. [Rule 2 - Missing critical functionality] Added defineExpose for containerEl in MoshpitView**
- **Found during:** Task 1-02-02
- **Issue:** TypeScript flagged `containerEl` as "declared but its value is never read" — the template ref binding alone doesn't satisfy strict unused-variable checking. Plan 03 requires this ref for Pixi Application mount.
- **Fix:** Added `defineExpose({ containerEl })` so the ref is both type-safe and accessible to the parent plan's canvas mounting logic.
- **Files modified:** `src/views/MoshpitView.vue`
- **Commit:** 577bb9236

## Threat Surface Scan

No new threat surface introduced beyond what was modeled in the plan's threat register:

- `/moshpit` route: covered by T-02-01 (existing cloud auth guard handles it)
- keep-alive cache: covered by T-02-02 (defineOptions name verified)
- MoshpitLayout shared stores: covered by T-02-03 (accepted — no store access in Phase 1)

No additional threat flags.

## Self-Check: PASSED

- FOUND: src/views/layouts/MoshpitLayout.vue
- FOUND: src/views/MoshpitView.vue
- FOUND: .planning/phases/01-workspace-shell-canvas-navigation/01-02-SUMMARY.md
- FOUND commit: 4b215f3e2 (Task 1-02-01)
- FOUND commit: 577bb9236 (Task 1-02-02)
