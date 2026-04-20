---
phase: 02-asset-pipeline
plan: 12
subsystem: moshpit/e2e
tags: [e2e, playwright, validation-map, wave-5]
dependency_graph:
  requires: [02-09, 02-10, 02-11]
  provides: [e2e-scaffolds, validation-map]
  affects: [browser_tests/tests/moshpit/, browser_tests/fixtures/helpers/]
tech_stack:
  added: []
  patterns: [test.skip-deferral, playwright-helper-extension]
key_files:
  created:
    - browser_tests/tests/moshpit/asset-pipeline.spec.ts
  modified:
    - browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts
    - .planning/phases/02-asset-pipeline/02-VALIDATION.md
decisions:
  - Use test.skip with Phase 3 deferral markers instead of test-only window handles to avoid production surface area
  - nyquist_compliant remains false — Phase 3 closes the E2E gap when filter gate lands
  - wave_0_complete flipped to true — Wave-0 TDD scaffolding did land (Plan 01)
metrics:
  duration: ~15 min
  completed: 2026-04-20T16:40:20Z
  tasks_completed: 1
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 2 Plan 12: E2E Scaffolds and Validation Map Summary

**One-liner:** Three skipped Playwright scaffolds for ASSET-07/08/10 with Phase 3 deferral markers, extended MoshpitCanvasHelper, and fully populated 14-row Per-Task Verification Map with honest nyquist_compliant=false.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend MoshpitCanvasHelper + ship asset-pipeline.spec.ts + honest VALIDATION.md | adc2d1516 | browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts, browser_tests/tests/moshpit/asset-pipeline.spec.ts, .planning/phases/02-asset-pipeline/02-VALIDATION.md |

## Tasks Pending (checkpoint)

| Task | Name | Status |
|------|------|--------|
| 2 | Human verification — run @moshpit suite against live backend | awaiting human-verify |

## What Was Built

### MoshpitCanvasHelper Extension

Added four locator helpers to `browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts`:

- `processingPill()` — locates `[data-testid="moshpit-processing-indicator"]`
- `excludedCountRow()` — locates `[data-testid="moshpit-excluded-count"]`
- `cancelButton()` — locates the cancel button inside the processing pill
- `waitForSpritesCount(n, timeoutMs)` — polls pill aria-label for done >= n

These helpers ship now so Phase 3's test rewrite only needs to touch the spec file.

### asset-pipeline.spec.ts

Three scenarios under `test.describe('Moshpit asset pipeline', { tag: '@moshpit' })`, all `test.skip` with Phase 3 deferral markers:

1. `cold cache shows processing pill and renders sprites progressively (ASSET-07)` — deferred to Phase 3 filter gate
2. `warm cache skips the pill (ASSET-10 / D-08)` — deferred to Phase 3 filter gate
3. `cancel button aborts processing and the pill disappears (ASSET-08)` — deferred to Phase 3 filter gate

Each skip includes the Phase 3 prelude (inline comments) so the future author sees exactly what steps to add when unskipping.

### VALIDATION.md

- Frontmatter updated: `wave_0_complete: true`, `nyquist_compliant: false` (with deferral note), `status: ready`
- Coverage Status section added documenting Phase 2 unit+integration authority per requirement
- Per-Task Verification Map populated with 14 rows covering Plans 01–12
- Wave 0 Requirements checked off
- Approval line updated: pending — awaiting Plan 11 + Plan 12 human checkpoints

## Deviations from Plan

None — plan executed exactly as specified. The pre-existing typecheck errors from Wave-0 RED stubs (Plans 01–10) are out of scope for this plan and documented as such.

## Known Stubs

None — no data stubs or placeholder text in the shipped code. The `test.skip` scaffolds are intentional and documented (not placeholder data flowing to UI).

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The E2E spec's `page.evaluate` IDB access is scoped to Playwright's isolated test origin and only activates when the scaffolds are unskipped in Phase 3.

## Self-Check

**Files created:**
- browser_tests/tests/moshpit/asset-pipeline.spec.ts — EXISTS
- .planning/phases/02-asset-pipeline/02-12-e2e-and-validation-map-SUMMARY.md — EXISTS (this file)

**Files modified:**
- browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts — MODIFIED (processingPill, excludedCountRow, cancelButton, waitForSpritesCount added)
- .planning/phases/02-asset-pipeline/02-VALIDATION.md — MODIFIED (14-row map, updated frontmatter)

**Commits:**
- adc2d1516 — feat(02-12): add E2E scaffolds, extend helper, populate validation map

## Self-Check: PASSED

All files exist, commit is present, acceptance criteria verified:
- test.skip count: 3 (✓)
- Phase 3 deferral markers: 3 (✓)
- Helper methods: 4+ (✓: processingPill, excludedCountRow, cancelButton, waitForSpritesCount)
- VALIDATION.md rows: 14 (✓)
- nyquist_compliant: false (✓)
- wave_0_complete: true (✓)
- Deferred to Phase 3 note: present (✓)
