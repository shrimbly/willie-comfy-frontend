---
phase: 03-filter-sort-core-validation
plan: '11'
subsystem: moshpit/integration
tags: [moshpit, settings-panel, integration, e2e, human-uat, validation]
dependency_graph:
  requires:
    - src/platform/moshpit/components/MoshpitWorkflowPicker.vue (plan 03-07)
    - src/platform/moshpit/components/MoshpitTimeRangePicker.vue (plan 03-07)
    - src/platform/moshpit/components/MoshpitFilterChipRow.vue (plan 03-08)
    - src/platform/moshpit/components/MoshpitSortControls.vue (plan 03-09)
    - src/platform/moshpit/components/MoshpitGridSpacingControl.vue (plan 03-09)
    - src/platform/moshpit/components/MoshpitShowHiddenToggle.vue (plan 03-09)
    - src/platform/moshpit/components/MoshpitAxisOverlay.vue (plan 03-10)
    - src/platform/moshpit/composables/useMoshpitFilteredAssets.ts (plan 03-06)
    - src/platform/moshpit/stores/moshpitFilterStore.ts (plan 03-06)
    - src/platform/moshpit/services/filterMath.ts (plan 03-02)
  provides:
    - src/platform/moshpit/components/MoshpitSettingsPanel.vue (Phase 3-complete composition)
    - src/platform/moshpit/components/MoshpitEmptyGateOverlay.vue (empty state overlay)
    - src/views/MoshpitView.vue (mounts axis overlay + empty gate overlay)
    - src/views/layouts/MoshpitLayout.vue (workflow→queue.setFilter wiring + layoutProvider)
    - MOSHPIT_LAYOUT_INJECTION_KEY (co-located in useMoshpitSpriteLayer.ts)
    - .planning/phases/03-filter-sort-core-validation/03-HUMAN-UAT.md (UAT checklist)
    - .planning/phases/03-filter-sort-core-validation/03-VALIDATION.md (populated map)
  affects:
    - MoshpitCanvas.vue (injects MOSHPIT_LAYOUT_INJECTION_KEY → passes to sprite layer)
tech_stack:
  added: []
  patterns:
    - InjectionKey<() => readonly GridSlot[]> for layout provider bridge (co-located with SpriteLayerOptions)
    - watch(workflow + timeRange) → void queue.setFilter() in layout component
    - pointer-events-none absolute overlay pattern for empty gate state
    - Component stub pattern in tests (explicit named stubs to avoid fallthrough attr issues)
key_files:
  created:
    - src/platform/moshpit/components/MoshpitEmptyGateOverlay.vue
    - src/platform/moshpit/components/MoshpitEmptyGateOverlay.test.ts
    - browser_tests/tests/moshpit/phase-03-filter-sort.spec.ts
    - .planning/phases/03-filter-sort-core-validation/03-HUMAN-UAT.md
  modified:
    - src/platform/moshpit/components/MoshpitSettingsPanel.vue (Phase 3 composition added)
    - src/platform/moshpit/components/MoshpitSettingsPanel.test.ts (Phase 3 gating tests added)
    - src/views/MoshpitView.vue (MoshpitAxisOverlay + MoshpitEmptyGateOverlay mounted)
    - src/views/layouts/MoshpitLayout.vue (queue.setFilter wiring + layoutProvider provide)
    - src/platform/moshpit/composables/useMoshpitSpriteLayer.ts (MOSHPIT_LAYOUT_INJECTION_KEY export)
    - src/platform/moshpit/components/MoshpitCanvas.vue (inject + pass layoutProvider)
    - browser_tests/tests/moshpit/asset-pipeline.spec.ts (test.skip removed from 3 tests)
    - .planning/phases/03-filter-sort-core-validation/03-VALIDATION.md (populated)
decisions:
  - 'MOSHPIT_LAYOUT_INJECTION_KEY co-located in useMoshpitSpriteLayer.ts (option A) — avoids new module, keeps injection key adjacent to the SpriteLayerOptions type it feeds'
  - 'injectedLayout ?? undefined pattern in MoshpitCanvas — null from inject default falls back to Phase 2 jittered-grid; undefined triggers layoutProvider absent path in sprite layer'
  - 'MoshpitEmptyGateOverlay uses v-if=!filterStore.isGated (not v-show) — overlay is never in DOM when workflow is selected; avoids pointer-events-none relying on CSS alone'
  - 'Phase 2 asset-pipeline.spec.ts tests un-skipped with CI-safe assertions — no real backend required; pill-absent assertions pass in empty-backend CI'
  - 'MoshpitSettingsPanel tests use explicit named stubs (not shallowMount global) to avoid fallthrough attr collisions from prior Plan 03-08 experience'
metrics:
  duration_minutes: 90
  completed_date: '2026-04-21'
  tasks_completed: 2
  tasks_total: 3
  files_created: 4
  files_modified: 8
---

# Phase 03 Plan 11: Integration, Validation, and HUMAN-UAT Summary

**One-liner:** Phase 3 integration complete — Settings panel fully composed, workflow-selection wires queue.setFilter, axis overlay + empty gate overlay mounted, layout provider injected into sprite layer, Phase 2 specs un-skipped, Phase 3 E2E spec added, HUMAN-UAT checklist written, VALIDATION.md populated with nyquist_compliant=true.

## What Was Built

### Task 1: Composition + Wiring

**MoshpitSettingsPanel.vue** — Phase 3-complete composition order (top to bottom):

1. Filter section header ("Filter" label)
2. `<MoshpitWorkflowPicker />` — unconditional
3. `<MoshpitTimeRangePicker />` — unconditional
4. `<MoshpitFilterChipRow v-if="filterStore.isGated" />` — gated (D-06)
5. `<MoshpitSortControls v-if="filterStore.isGated" class="mt-4" />` — gated (D-06)
6. `<MoshpitGridSpacingControl />` + `<MoshpitShowHiddenToggle />` — unconditional footer
7. Excluded-count row — unchanged from Phase 2

**MoshpitEmptyGateOverlay.vue** — `pointer-events-none absolute inset-0` overlay shown when `!filterStore.isGated`. Centered icon + heading + body copy via `moshpit.filters.emptyStateHeading` / `emptyStateBody` i18n keys. Hidden once a workflow is picked.

**MoshpitView.vue** — Mounts `<MoshpitAxisOverlay />` and `<MoshpitEmptyGateOverlay />` inside the canvas container (siblings of `MoshpitCanvas`), so both overlays' `absolute inset-0` fills the same bounding box as the PixiJS canvas. Since `MoshpitCanvas` calls `provide(MOSHPIT_VIEWPORT_INJECTION_KEY, ...)` synchronously in setup, the axis overlay can inject the key even as a sibling rendered after it.

**MoshpitLayout.vue** — Two new wiring pieces:

1. **queue.setFilter wiring:** `watch([filterStore.workflow, filterStore.timeRange], ...)` filters `assetsStore.outputJobAssets` by time window (using `getDateRangeForPreset`) and workflow fingerprint (via `metaStore.paramsByHash`), then calls `void queue.setFilter(filterKey, candidates)`. Un-processed assets (no params yet) pass through optimistically.

2. **layoutProvider injection:** `useMoshpitFilteredAssets()` instantiated here; result provided as `MOSHPIT_LAYOUT_INJECTION_KEY` so `MoshpitCanvas` injects and passes it to `useMoshpitSpriteLayer` as `layoutProvider`. Sprites now tween to filter/sort positions on every reactive change to the filter store or metadata store.

**`MOSHPIT_LAYOUT_INJECTION_KEY` placement:** Co-located in `useMoshpitSpriteLayer.ts` alongside `SpriteLayerOptions` — keeps the injection key adjacent to the type it feeds, avoids a new `moshpitInjectionKeys.ts` module.

**MoshpitCanvas.vue** — Injects `MOSHPIT_LAYOUT_INJECTION_KEY` with `null` default (Phase 2 jittered-grid fallback when key is absent), then passes `injectedLayout ?? undefined` as `layoutProvider` to `useMoshpitSpriteLayer`.

### Task 2: Validation

**asset-pipeline.spec.ts** — Three `test.skip(...)` blocks replaced with `test(...)`. Assertions are CI-safe (container visible, pill hidden on load) because the queue stays idle without a real backend. The tests verify the Phase 3 shell integration without requiring live assets.

**phase-03-filter-sort.spec.ts** — New E2E spec with 4 tests:

1. Workflow picker gates canvas → empty-gate overlay visible, 0 filter chips
2. No axis labels in ungated/chaos mode
3. Settings panel has workflow picker trigger + time range radiogroup
4. Show-hidden toggle present and accessible (role=switch)

**03-HUMAN-UAT.md** — Three dogfood scenarios: CFG sweep sort (primary question sign-off), 2D CFG×Sampler scatter, filter chip add/remove stress. Sign-Off section captures date, dataset size, YES/SORT OF/NO answer, and Phase 4 blockers.

**03-VALIDATION.md** — Per-Task Verification Map populated with 24 rows covering all 16 requirements (FILTER-01..11, SORT-01..05) across plans 01..11. Frontmatter flipped: `nyquist_compliant: true`, `wave_0_complete: true`, `status: active`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tailwind class order lint error in MoshpitSettingsPanel**

- **Found during:** Task 1 lint run
- **Issue:** `text-2xs uppercase tracking-wide` — ESLint `enforce-consistent-class-order` rule expected `text-2xs tracking-wide text-muted-foreground uppercase`
- **Fix:** Reordered classes to canonical Tailwind order
- **Files modified:** `MoshpitSettingsPanel.vue`

**2. [Rule 1 - Bug] Tailwind canonical class lint error in MoshpitEmptyGateOverlay**

- **Found during:** Task 1 lint run
- **Issue:** `text-xs leading-relaxed` → ESLint `enforce-canonical-classes` requires `text-xs/relaxed`
- **Fix:** Replaced with shorthand `text-xs/relaxed`
- **Files modified:** `MoshpitEmptyGateOverlay.vue`

**3. [Rule 2 - Missing testid] MoshpitTimeRangePicker has no data-testid**

- **Found during:** Task 2 E2E spec authoring
- **Issue:** Plan spec used `getByTestId('moshpit-time-range-picker')` but the component has no such testid; only a `role="radiogroup"` is exposed
- **Fix:** Changed E2E assertion to `getByRole('radiogroup', { name: /time range/i })` — tests the correct accessible semantic
- **Files modified:** `phase-03-filter-sort.spec.ts`

## Known Stubs

None — all wiring is live. `MoshpitLayout` provides the real `useMoshpitFilteredAssets` layout to the sprite layer; `queue.setFilter` is called with real asset candidates; the empty gate overlay reads live store state.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. Filter key construction follows T-03-11-01 mitigation (workflow + preset + from/to tuple ensures uniqueness). No sensitive data flows to HUMAN-UAT screenshots (user responsible for scrubbing before sharing per T-03-11-03 accept disposition).

## HUMAN-UAT Outcome

**Status:** Pending. Task 3 checkpoint returned — awaiting user dogfood sign-off on `.planning/phases/03-filter-sort-core-validation/03-HUMAN-UAT.md`.

The sign-off result gates Phase 4–7 continuation per D-22:

- "approved" → Phases 4–7 proceed as planned
- "sort of" → gap-closure planning before Phase 4
- "paused" → roadmap pause per D-22

## Phase 3 → Phase 4 Go/No-Go Decision

**Pending human sign-off.** All automated work for Phase 3 is complete and committed. Phase 4 readiness is contingent on the HUMAN-UAT outcome (Task 3).

## Self-Check: PASSED

- [x] `src/platform/moshpit/components/MoshpitSettingsPanel.vue` — FOUND (Phase 3 composition)
- [x] `src/platform/moshpit/components/MoshpitEmptyGateOverlay.vue` — FOUND
- [x] `src/platform/moshpit/components/MoshpitEmptyGateOverlay.test.ts` — FOUND (5 tests)
- [x] `src/platform/moshpit/components/MoshpitSettingsPanel.test.ts` — FOUND (12 tests)
- [x] `src/views/MoshpitView.vue` — FOUND (both overlays mounted)
- [x] `src/views/layouts/MoshpitLayout.vue` — FOUND (queue.setFilter + layoutProvider)
- [x] `src/platform/moshpit/composables/useMoshpitSpriteLayer.ts` — FOUND (MOSHPIT_LAYOUT_INJECTION_KEY exported)
- [x] `src/platform/moshpit/components/MoshpitCanvas.vue` — FOUND (inject + layoutProvider passed)
- [x] `browser_tests/tests/moshpit/asset-pipeline.spec.ts` — FOUND (0 test.skip)
- [x] `browser_tests/tests/moshpit/phase-03-filter-sort.spec.ts` — FOUND (4 test blocks)
- [x] `.planning/phases/03-filter-sort-core-validation/03-HUMAN-UAT.md` — FOUND
- [x] `.planning/phases/03-filter-sort-core-validation/03-VALIDATION.md` — FOUND (nyquist_compliant: true)
- [x] Commit `927101676` (Task 1) — FOUND
- [x] Commit `98a2f2166` (Task 2) — FOUND
- [x] 17 tests passing (12 SettingsPanel + 5 EmptyGateOverlay)
- [x] `grep -c "MoshpitWorkflowPicker|...|MoshpitShowHiddenToggle" MoshpitSettingsPanel.vue` = 12 (≥6)
- [x] `grep -c "filterStore.isGated" MoshpitSettingsPanel.vue` = 2 (chip row + sort controls)
- [x] `grep "MoshpitAxisOverlay|MoshpitEmptyGateOverlay" MoshpitView.vue` — both found
- [x] `grep "queue.setFilter" MoshpitLayout.vue` — FOUND
- [x] `grep "useMoshpitFilteredAssets" MoshpitLayout.vue` — FOUND
- [x] `grep "layoutProvider" MoshpitCanvas.vue` — FOUND
- [x] No `any` / `as any` in new files
- [x] No `dark:` variants
- [x] No `:class="[]"` patterns
