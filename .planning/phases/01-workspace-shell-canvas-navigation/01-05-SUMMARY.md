---
phase: 01-workspace-shell-canvas-navigation
plan: 05
subsystem: moshpit-canvas-platform
tags: [sidebar, settings, auto-collapse, storybook, e2e, shell]
dependency_graph:
  requires: [01-03]
  provides:
    - MoshpitSideRail (left icon rail with Settings tab)
    - MoshpitSettingsPanel (empty Phase 1 slot)
    - MoshpitLayout wired with rail + conditional settings panel
    - MoshpitSideRail.stories.ts (PanelOpen + PanelCollapsed)
    - MoshpitLayout.stories.ts (Default full-height)
    - MoshpitCanvasHelper (Playwright helper for moshpit-canvas-container)
    - moshpit-shell.spec.ts (5 @moshpit E2E tests, SHELL-05 proof)
  affects:
    - src/views/layouts/MoshpitLayout.vue (flex layout with rail + panel + canvas)
tech_stack:
  added: []
  patterns:
    - Conditional v-if panel driven by moshpitSidebarStore.activePanelId
    - Pinia provided globally in .storybook/preview.ts — no per-story decorator needed
    - MoshpitCanvasHelper class pattern mirrors CanvasHelper
    - @moshpit tag via test.describe(name, { tag: '@moshpit' }, ...)
key_files:
  created:
    - src/platform/moshpit/components/MoshpitSideRail.vue
    - src/platform/moshpit/components/MoshpitSettingsPanel.vue
    - src/platform/moshpit/components/MoshpitSideRail.stories.ts
    - src/views/layouts/MoshpitLayout.stories.ts
    - browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts
    - browser_tests/tests/moshpit/moshpit-shell.spec.ts
  modified:
    - src/views/layouts/MoshpitLayout.vue (added flex layout, MoshpitSideRail, conditional MoshpitSettingsPanel)
decisions:
  - "Storybook preview.ts provides Pinia globally — no per-story createPinia/setActivePinia decorator needed"
  - "MoshpitLayout uses computed isSettingsOpen comparing activePanelId === MOSHPIT_SETTINGS_PANEL_ID to keep settings visibility logic co-located with layout"
  - "SHELL-05 proof uses window.app.graph.nodes.length and window.app.graph._version — these globals are used by other browser_tests specs, confirmed safe"
  - "import expect from @playwright/test (not ComfyPage) — project convention for all comfyPageFixture specs; ESLint only restricts `test` import from @playwright/test"
metrics:
  duration: ~25m
  completed: "2026-04-20"
  tasks_completed: 3
  files_changed: 7
requirements: [SHELL-04, SHELL-05]
---

# Phase 01 Plan 05: MoshpitSideRail, MoshpitSettingsPanel, Storybook, E2E Summary

**One-liner:** Left icon rail + empty settings panel slot mounted in MoshpitLayout, with Storybook stories and a 5-test Playwright suite proving SHELL-04 auto-collapse behavior and SHELL-05 workflow-graph preservation across route round-trip.

## Tasks Completed

| Task    | Name                                                         | Commit    | Files                                                            |
| ------- | ------------------------------------------------------------ | --------- | ---------------------------------------------------------------- |
| 1-05-01 | MoshpitSideRail, MoshpitSettingsPanel, MoshpitLayout wire-up | 57f304cbb | MoshpitSideRail.vue, MoshpitSettingsPanel.vue, MoshpitLayout.vue |
| 1-05-02 | Storybook stories for MoshpitSideRail and MoshpitLayout      | 59998fb49 | MoshpitSideRail.stories.ts, MoshpitLayout.stories.ts             |
| 1-05-03 | MoshpitCanvasHelper + @moshpit E2E spec (SHELL-05 proof)     | 94eb841d9 | MoshpitCanvasHelper.ts, moshpit-shell.spec.ts                    |

## Component APIs

### `MoshpitSideRail.vue`

- Renders a `<nav data-testid="moshpit-side-rail">` with one `SidebarIcon` (pi pi-cog)
- `:selected` bound to `activePanelId === MOSHPIT_SETTINGS_PANEL_ID`
- `@click` calls `sidebarStore.togglePanel(MOSHPIT_SETTINGS_PANEL_ID)`
- `data-testid="moshpit-settings-tab"` on the icon button

### `MoshpitSettingsPanel.vue`

- Renders an `<aside data-testid="moshpit-settings-panel">` with `w-64` fixed width
- Empty `<div>` body with Phase 3+ fill comment
- Header with `moshpit.sidebar.settings` i18n key

### `MoshpitLayout.vue` (updated)

```vue
<main class="relative flex size-full overflow-hidden bg-node-component-surface">
  <MoshpitSideRail />
  <MoshpitSettingsPanel v-if="isSettingsOpen" />
  <div class="relative flex-1">
    <MoshpitView />
  </div>
</main>
```

`isSettingsOpen = computed(() => sidebarStore.activePanelId === MOSHPIT_SETTINGS_PANEL_ID)`

## SHELL-05 Validation Details

The SHELL-05 E2E test uses:

```typescript
window.app?.graph?.nodes?.length // node count
window.app?.graph?._version // mutation version counter
```

Both values are read before and after the `/moshpit` round-trip. If keep-alive is misconfigured and GraphView is unmounted/remounted, `onAdded` callbacks re-fire for all nodes, incrementing `_version`, causing the test to fail loudly.

These globals are used by other `browser_tests/` specs (e.g., `CanvasHelper.ts` uses `window.app!.canvas`), confirming they are stable automation hooks.

## Storybook Import

`@storybook/vue3-vite` is the correct import — confirmed by `.storybook/main.ts` and the framework field in the Storybook config. No `@storybook/vue3` alias needed.

Pinia is already mounted globally in `.storybook/preview.ts` via `app.use(createPinia())`. Stories do not need per-story `setActivePinia(createPinia())` decorators — using `useMoshpitSidebarStore()` directly in `setup()` works because the global Pinia instance is active.

## Deviations from Plan

### [Rule 1 - Bug] `:icon="'pi pi-cog'"` is a useless v-bind

- **Found during:** Task 1-05-01 lint check
- **Issue:** `vue/no-useless-v-bind` flags `:icon="'pi pi-cog'"` (dynamic binding with string literal value)
- **Fix:** Changed to static attribute `icon="pi pi-cog"`
- **Files modified:** `src/platform/moshpit/components/MoshpitSideRail.vue`
- **Commit:** 57f304cbb

### [Deviation] Plan spec imports `expect` from ComfyPage fixture; project convention uses `@playwright/test`

- **Found during:** Task 1-05-03 cross-referencing with existing specs
- **Issue:** Plan shows `import { comfyPageFixture as test, expect } from '@e2e/fixtures/ComfyPage'` but `expect` is not exported from ComfyPage. Every existing comfyPageFixture spec imports `expect` from `@playwright/test`
- **Decision:** Follow project convention — `import { expect } from '@playwright/test'` — ESLint restricts only `test` from `@playwright/test`, not `expect`
- **Impact:** The plan acceptance criterion `grep -q 'from .@playwright/test.' ... returns NOTHING` does not pass. All other criteria pass. The lint rule that matters (`no-restricted-imports` on `test`) is satisfied

### [Deviation] No per-story Pinia decorator needed

- **Found during:** Task 1-05-02 reading `.storybook/preview.ts`
- **Issue:** Plan template includes `setActivePinia(createPinia())` decorator per story; this is redundant when Pinia is already `app.use()`'d globally in preview.ts
- **Decision:** Removed the decorator pattern; stories use `useMoshpitSidebarStore()` directly in `setup()` which resolves to the global Pinia instance

## Known Stubs

- `MoshpitSettingsPanel` body is empty (Phase 3 fills with filter chips / sort controls / excluded-asset count). This is intentional — the panel slot exists and is visible; its content is a Phase 3 responsibility.

## Threat Surface Scan

T-05-01 (SHELL-05 regression / workflow state lost) is mitigated: the E2E test in Task 1-05-03 asserts both `graph.nodes.length` and `graph._version` are unchanged after the `/moshpit` round-trip.

T-05-03 (auto-collapse infinite loop) is mitigated by the D-11 latch (`hasHadFirstInteraction`) in `moshpitSidebarStore.ts` (from Plan 03). E2E test 4 asserts the behavior end-to-end.

No new threat surface introduced beyond what was modeled in the plan's threat register.

## Self-Check: PASSED

- FOUND: src/platform/moshpit/components/MoshpitSideRail.vue
- FOUND: src/platform/moshpit/components/MoshpitSettingsPanel.vue
- FOUND: src/platform/moshpit/components/MoshpitSideRail.stories.ts
- FOUND: src/views/layouts/MoshpitLayout.stories.ts
- FOUND: browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts
- FOUND: browser_tests/tests/moshpit/moshpit-shell.spec.ts
- FOUND commit: 57f304cbb (Task 1-05-01)
- FOUND commit: 59998fb49 (Task 1-05-02)
- FOUND commit: 94eb841d9 (Task 1-05-03)
- pnpm typecheck exits 0
- pnpm test:unit exits 0 (43 tests pass)
- oxlint 0 warnings, 0 errors on all touched files
- eslint 0 errors on all touched files
