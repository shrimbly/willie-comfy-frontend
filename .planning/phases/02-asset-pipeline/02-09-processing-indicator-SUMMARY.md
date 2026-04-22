---
phase: 02-asset-pipeline
plan: '09'
subsystem: moshpit-ui
tags: [ui, pill, overlay, a11y, i18n, wave-4]
dependency_graph:
  requires: [02-07, 02-08]
  provides: [processing-indicator-pill, moshpit-layout-wiring]
  affects: [MoshpitLayout, MoshpitProcessingIndicator]
tech_stack:
  added: []
  patterns:
    - absolute-positioned canvas overlay (z-50, bottom-4 left-4)
    - role=status aria-live=polite for progressive announcements
    - role=progressbar with aria-valuenow/min/max
    - completion fade sequence: 600ms hold + 200ms opacity transition + emit done
    - queue composable owned at layout scope (single owner pattern)
key_files:
  created:
    - src/platform/moshpit/components/MoshpitProcessingIndicator.vue
    - src/platform/moshpit/components/MoshpitProcessingIndicator.stories.ts
  modified:
    - src/locales/en/main.json
    - src/views/layouts/MoshpitLayout.vue
    - src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts
decisions:
  - test file required i18n plugin addition (createI18n + enMessages) to mount useI18n-dependent component
  - ReturnType<typeof setTimeout> used instead of window.setTimeout to avoid DOM/Node type ambiguity
metrics:
  duration: ~8 minutes
  completed: 2026-04-21
  tasks_completed: 3
  files_created: 2
  files_modified: 3
---

# Phase 02 Plan 09: Processing Indicator Summary

**One-liner:** Bottom-left processing pill with aria-live progress bar, 600ms+200ms completion fade, cancel wired to queue composable, all six moshpit.assets.\* i18n keys.

## What Was Built

### Task 1 — i18n keys (commit: `4acfa0d72`)

Added six keys under `moshpit.assets.*` in `src/locales/en/main.json`:

- `processing` — "Processing {done} / {total}"
- `cancel` — "Cancel processing"
- `excludedCount` — ICU plural for excluded asset count
- `excludedTooltip` — full explanation copy
- `excludedTooltipLabel` — screen reader label for info icon
- `processingComplete` — reserved for future aria-live announcement

### Task 2 — MoshpitProcessingIndicator.vue + stories (commit: `a74cb4cd6`)

Pill component per 02-UI-SPEC:

- `role="status" aria-live="polite" aria-atomic="false"` on wrapper
- `role="progressbar"` with `aria-valuenow/min/max` on the bar
- `size-8` (32×32px) cancel button with `aria-label` from i18n, `icon-[lucide--x] size-4`
- Progress fill uses `bg-(--color-interface-panel-job-progress-primary)` with `transition-[width] duration-300 ease-out`
- Completion sequence: `setTimeout(..., 600)` → `isFading = true`, `setTimeout(..., 800)` → `emit('done')`
- `cn()` for conditional opacity merge (no `:class="[]"`, no `dark:`, no `!important`)
- Storybook stories: `Processing` (12/48) and `NearComplete` (47/48)
- All 4 Wave-4 component tests GREEN

### Task 3 — MoshpitLayout wiring (commit: `9e972ea2e`)

- `useMoshpitProcessingQueue()` instantiated at layout scope (single owner)
- `v-if="queue.isActive.value || showCompletionPulse"` drives mount/unmount
- `showCompletionPulse` ref handles the window between `done===total` and `emit('done')`
- Indicator mounted inside `<div class="relative flex-1">` canvas area (absolute-positioned)
- `onCancel` → `queue.cancel()`, `onIndicatorDone` → resets `showCompletionPulse`
- `splash-loader` removal preserved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test file missing i18n plugin**

- **Found during:** Task 2
- **Issue:** The Wave-0 RED test file used `global: { plugins: [createPinia()] }` without `createI18n`. The component calls `useI18n()` which throws "Need to install with `app.use` function" when mounted without the i18n plugin.
- **Fix:** Added `import { createI18n } from 'vue-i18n'`, imported `enMessages` from the locale file, constructed an `i18n` instance, and added it to the `mountPill` global plugins array. Pattern matches `MoshpitSettingsPanel.test.ts` exactly.
- **Files modified:** `src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts`
- **Commit:** `a74cb4cd6`

**2. [Rule 1 - Minor] setTimeout type annotation**

- **Found during:** Task 2
- **Issue:** `window.setTimeout` return type is `number` in DOM but `NodeJS.Timeout` in Node — using `window.setTimeout` directly could cause type issues in the test environment.
- **Fix:** Used `ReturnType<typeof setTimeout>` for `holdTimer` and `unmountTimer` to be environment-agnostic, and called `setTimeout` without `window.` prefix.
- **Files modified:** `src/platform/moshpit/components/MoshpitProcessingIndicator.vue`
- **Commit:** `a74cb4cd6`

## Known Stubs

None — all data flows are wired. The pill renders live `done`/`total` values from the queue composable.

## Self-Check

**Files exist:**

- `src/platform/moshpit/components/MoshpitProcessingIndicator.vue` — FOUND
- `src/platform/moshpit/components/MoshpitProcessingIndicator.stories.ts` — FOUND
- `src/locales/en/main.json` contains `moshpit.assets.processing` — FOUND
- `src/views/layouts/MoshpitLayout.vue` contains `MoshpitProcessingIndicator` — FOUND

**Commits exist:**

- `4acfa0d72` — i18n keys
- `a74cb4cd6` — component + stories + test fix
- `9e972ea2e` — layout wiring

**Tests:** 84/84 moshpit tests pass (16 test files)

## Self-Check: PASSED
