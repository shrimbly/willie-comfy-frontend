---
phase: 04-lineage-groupings-within-cluster-sort
plan: 06
subsystem: moshpit
tags:
  [
    integration,
    settings-panel,
    cluster-overlay,
    i18n-cleanup,
    human-uat,
    validation-map,
    playwright-deferred
  ]

requires:
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 01
    provides: clusterLayout / groupAxes math primitives
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 02
    provides: saveNodeIdentity in NormalizedParams (IDB v3)
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 03
    provides: moshpitFilterStore grouping state + useMoshpitFilteredAssets().clusterTree; legacy sort-UI deletions
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 04
    provides: MoshpitGroupingToggles + MoshpitWithinClusterSort + MoshpitAdvancedFilters + tier-aware MoshpitFilterChipRow + Primary/Advanced popover
  - phase: 04-lineage-groupings-within-cluster-sort
    plan: 05
    provides: MoshpitClusterOverlay
provides:
  - Recomposed MoshpitSettingsPanel (initial filter gate → grouping toggles → primary chip row → within-cluster sort → Advanced disclosure → grid-spacing → show-hidden → excluded count)
  - MoshpitClusterOverlay mounted in src/views/MoshpitView.vue parallel to the sprite layer
  - moshpit.sort.* i18n block fully removed; moshpit.grouping.spacingValue added; showHiddenLabel relocated to moshpit.filters
  - MoshpitGridSpacingControl + MoshpitShowHiddenToggle label migration to the grouping/filters namespaces
  - 04-HUMAN-UAT.md — D-20 dogfood checklist with 8 scenario steps + D-22 gate statement
  - 04-VALIDATION.md populated with 19 real per-task rows across plans 01..06; nyquist_compliant flipped to true
affects:
  [
    Phase 05 Tournament Mode — start is gated on human D-22 sign-off via 04-HUMAN-UAT.md
  ]

tech-stack:
  added: []
  patterns:
    - Initial-gate-then-reveal settings composition (filterStore.isGated drives grouping/chip/sort/advanced visibility)
    - Cluster overlay mounted unconditionally — internal null-tree fallback keeps DOM stable for viewport injection
    - Per-phase per-task verification map with deferral annotations (⚠️ deferred) for best-effort work blocked by out-of-scope infra issues

key-files:
  created:
    - .planning/phases/04-lineage-groupings-within-cluster-sort/04-HUMAN-UAT.md
  modified:
    - src/platform/moshpit/components/MoshpitSettingsPanel.vue
    - src/platform/moshpit/components/MoshpitSettingsPanel.test.ts
    - src/views/MoshpitView.vue
    - src/platform/moshpit/components/MoshpitGridSpacingControl.vue
    - src/platform/moshpit/components/MoshpitGridSpacingControl.test.ts
    - src/platform/moshpit/components/MoshpitShowHiddenToggle.vue
    - src/locales/en/main.json
    - .planning/phases/04-lineage-groupings-within-cluster-sort/04-VALIDATION.md
    - .planning/phases/04-lineage-groupings-within-cluster-sort/deferred-items.md

key-decisions:
  - 'MoshpitClusterOverlay mounted in src/views/MoshpitView.vue (not MoshpitCanvas.vue) per Plan 03 SUMMARY executor note — the deleted MoshpitAxisOverlay lived in MoshpitView alongside the sprite layer, so the cluster overlay replaces it in the same parent.'
  - 'i18n cleanup + grid-spacing label rename committed as a single atomic change (Tasks 3 + 4). Both edits touch src/locales/en/main.json and share the same migration narrative: the removal of moshpit.sort.* and the introduction of moshpit.grouping.spacingLabel / spacingValue are coupled; splitting them produces a broken intermediate state.'
  - "showHiddenLabel relocated from the deleted moshpit.sort block to moshpit.filters.showHiddenLabel — it's a filter-like concern, not a sort-like one; moshpit.filters already existed with a matching ad-hoc key. MoshpitShowHiddenToggle.vue updated to consume the new path."
  - 'Task 5 (Playwright @moshpit spec) deferred per D-21 — pre-existing typecheck:browser failures on main block any new browser_tests/ commits, and the spec is explicitly discretionary scope. Full deferral rationale + follow-up work logged to deferred-items.md.'
  - 'VALIDATION.md map surfaces the Task 5 deferral as ⚠️ deferred status rather than omitting it — keeps the accountability trail visible for the next planner.'

patterns-established:
  - 'Initial-gate-then-reveal pattern for settings panels: v-if="filterStore.isGated" on every post-gate block (grouping / chips / within-sort / advanced). Layout order assertions in tests verify the render order matches the documented spec.'
  - 'Deferral with full replacement path: when a task is blocked by out-of-scope infra (tsconfig mismatch), log the reason + recovery steps to deferred-items.md and mark ⚠️ deferred in VALIDATION.md rather than silently dropping.'
  - 'Phase-level HUMAN-UAT as a binary gate (D-22). Phase 4 is v3 Core Value validation — the qualitative sign-off is the acceptance criterion, not a nice-to-have.'

requirements-completed:
  - GROUP-01
  - GROUP-02
  - GROUP-03
  - GROUP-04
  - GROUP-05
  - GROUP-06
  - GROUP-07
  - GROUP-08
  - GROUP-09
  - GROUP-10
  - CSORT-01
  - FILTER-12

duration: ~55 min
completed: 2026-04-21
---

# Phase 04 Plan 06: Integration + HUMAN-UAT Authoring Summary

**Settings-panel composition + cluster overlay mount + moshpit.sort.\* i18n removal + 04-HUMAN-UAT.md (D-22 gate) + VALIDATION map population; Task 5 Playwright spec deferred per D-21 due to pre-existing typecheck:browser failure.**

## Performance

- **Duration:** ~55 minutes (across sequential executor sessions)
- **Started (this session):** 2026-04-21T06:20Z (continuation from prior agent interrupt)
- **Completed:** 2026-04-21T07:00Z
- **Tasks:** 6 of 7 complete (Task 7 is the blocking human-verify checkpoint); Task 5 deferred per D-21
- **Files modified:** 7 source files + 3 planning docs

## Accomplishments

### Task 1 — MoshpitSettingsPanel recomposition (committed 2649a98f0)

Rewrote the settings panel template to mount, in order: initial filter gate (workflow + time pickers) → MoshpitGroupingToggles → MoshpitFilterChipRow (tier=primary) → MoshpitWithinClusterSort → MoshpitAdvancedFilters → MoshpitGridSpacingControl → MoshpitShowHiddenToggle → excluded-count row. All post-gate blocks are conditional on `filterStore.isGated`.

Tests extended to assert layout order and gate-driven visibility.

### Task 2 — MoshpitClusterOverlay mount (committed 42467e894)

Confirmed via grep that the sprite layer lives in `src/views/MoshpitView.vue` (not `MoshpitCanvas.vue`), matching the Plan 03 SUMMARY executor note. Mounted `<MoshpitClusterOverlay />` parallel to the sprite layer in MoshpitView. No `v-if` gating — the overlay's internal null-tree fallback handles the pre-gate state.

### Task 3 — moshpit.sort.\* i18n removal (committed fcbe1a48a — combined with Task 4)

Removed the entire `moshpit.sort` block from `src/locales/en/main.json` (12 keys: sectionLabel, xAxisLabel, yAxisLabel, xAxisPlaceholder, yAxisPlaceholder, clearAxis, axisSetAnnouncement, axisClearedAnnouncement, gridSpacingLabel, gridSpacingValue, gridSpacingDisabledTooltip, showHiddenLabel). Added `moshpit.grouping.spacingValue: "{value}px"`. Verified via portable `[ ! -f ]` tests that Plan 03 Task 4's deletions still hold.

`pnpm typecheck`, `pnpm knip` remain green (knip flags only pre-existing, unrelated items in src/platform/assets/ and src/components/sidebar/).

### Task 4 — Grid-spacing + show-hidden label migration (committed fcbe1a48a)

- `MoshpitGridSpacingControl.vue`: `t('moshpit.sort.gridSpacingLabel')` → `t('moshpit.grouping.spacingLabel')`; `gridSpacingValue` → `moshpit.grouping.spacingValue`; aria-label updated. The disabled-tooltip branch was already removed by prior work.
- `MoshpitShowHiddenToggle.vue`: `t('moshpit.sort.showHiddenLabel')` → `t('moshpit.filters.showHiddenLabel')`. Label relocated from the deleted sort block to the filters namespace (semantically correct — show-hidden is a filter concern).
- Test assertions updated to match new label text.

All 13 tests across both files green.

### Task 5 — Playwright @moshpit spec — DEFERRED (per D-21)

Wrote the full spec (5 UI-chrome tests: grouping toggles absent before gate / within-cluster sort absent before gate / advanced disclosure absent before gate / cluster overlay root mounted / legacy axis + sort controls fully absent). All 5 tests listed successfully via `playwright test --list`.

**Deferral reason:** The husky pre-commit hook runs `pnpm typecheck:browser` whenever a `browser_tests/` file is staged. That check already fails on `main` due to a tsconfig strictness mismatch between the main and browser_tests tsconfigs:

- `src/composables/useGlobalLitegraph.ts(17,3)` + `(33,3)`: directives needed by main typecheck, flagged unused by browser typecheck
- `browser_tests/tests/moshpit/moshpit-shell.spec.ts(56/60/71/75)`: directives flagged unused by browser typecheck

The two tsconfigs disagree on whether `window['X'] = ...` assignments need `@ts-expect-error`. Removing directives fixes `typecheck:browser` but breaks `pnpm typecheck`, and vice versa. This is an out-of-scope tsconfig reconciliation task and is not triggered by any Phase 4 code — it's present on `main`.

Per D-21 ("No Playwright E2E fixture blocks Phase 4 acceptance. A @moshpit spec may cover ... best-effort"), Task 5 is explicitly discretionary. Full deferral rationale + the 5 test specs + follow-up repair steps logged to `deferred-items.md`. Phase 4 is NOT gated on this.

### Task 6 — HUMAN-UAT + VALIDATION map (committed 922832505)

- Created `04-HUMAN-UAT.md` (117 lines) with prerequisites, launch steps, 8-step D-20 dogfood scenario (baseline flat grid → workflow grouping → + prompt → + save_node + model + type → within-cluster sort → advanced disclosure → cross-interaction → qualitative sign-off), D-22 gate statement, signature block.
- Updated `04-VALIDATION.md`: populated Per-Task Verification Map with 19 real task rows covering plans 01..06 (each row has real file path + `pnpm test:unit -- <path>` command); flipped frontmatter `nyquist_compliant: false → true` and `wave_0_complete: false → true`; corrected Wave 0 paths from legacy `src/workbench/moshpit/` to actual `src/platform/moshpit/`; flagged Task 06-T5 as ⚠️ deferred with pointer to deferred-items.md.

### Task 7 — Human-verify checkpoint — AWAITING USER

Returning structured checkpoint state. User runs through 04-HUMAN-UAT.md on real ComfyUI backend, answers the D-22 qualitative sign-off question (YES / SORT OF / NO), then resumes the plan with the verdict.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 5 Playwright spec deferred due to pre-existing typecheck:browser failure**

- **Found during:** Task 5 commit attempt
- **Issue:** Husky pre-commit hook's `typecheck:browser` fires on every `browser_tests/` staging and fails on pre-existing unused `@ts-expect-error` directives in `src/composables/useGlobalLitegraph.ts` and `browser_tests/tests/moshpit/moshpit-shell.spec.ts`. The errors exist identically on `main` — not caused by Plan 04-06.
- **Fix attempted:** Removed the 2 directives in useGlobalLitegraph.ts (lines 17 and 33) — broke `pnpm typecheck` with TS7015 index-signature errors, because the two tsconfigs disagree on strictness. Reverted.
- **Resolution:** Deferred Task 5 per D-21's explicit discretionary-scope language. Full rationale + 5-test spec design + follow-up repair steps logged to `deferred-items.md`. VALIDATION map shows Task 06-T5 as ⚠️ deferred.
- **Scope justification:** Pre-existing, unrelated to Phase 4 domain, out of plan scope, and Task 5 is best-effort per D-21.

### Scope Consolidations

**2. Tasks 3 + 4 committed atomically (single commit fcbe1a48a)**

The i18n key removal (Task 3) and the grid-spacing label rename (Task 4) both touch `src/locales/en/main.json` and form a single coherent migration. Splitting them produces a broken intermediate state where `MoshpitGridSpacingControl.vue` references a deleted key. Landed as one commit.

## Final Settings Panel Layout Order

(Top → bottom, per the rewritten MoshpitSettingsPanel.vue template)

1. Initial filter gate: `MoshpitWorkflowPicker` + `MoshpitTimeRangePicker` (always rendered)
2. `MoshpitGroupingToggles` (v-if filterStore.isGated)
3. `MoshpitFilterChipRow` tier="primary" (v-if filterStore.isGated)
4. `MoshpitWithinClusterSort` (v-if filterStore.isGated)
5. `MoshpitAdvancedFilters` (v-if filterStore.isGated — internally hosts the advanced chip row)
6. `MoshpitGridSpacingControl` (always rendered)
7. `MoshpitShowHiddenToggle` (always rendered)
8. Excluded-count row (v-if excludedCount > 0)

## Cluster Overlay Mount Location

`src/views/MoshpitView.vue` (not `MoshpitCanvas.vue`). Matches the Plan 03 SUMMARY executor note — the deleted `MoshpitAxisOverlay` lived in MoshpitView alongside the sprite layer, and the cluster overlay replaces it in the same parent.

## Plan 03 Task 4 Deletions — Still Hold

Verified via portable POSIX `[ ! -f ]` tests:

- `src/platform/moshpit/components/MoshpitSortControls.vue` — absent
- `src/platform/moshpit/components/MoshpitSortControls.test.ts` — absent
- `src/platform/moshpit/components/MoshpitAxisOverlay.vue` — absent
- `src/platform/moshpit/components/MoshpitAxisOverlay.test.ts` — absent
- `src/platform/moshpit/components/MoshpitSortControls.stories.ts` — absent
- `src/platform/moshpit/components/MoshpitAxisOverlay.stories.ts` — absent

Full-project `grep -rn "MoshpitSortControls\|MoshpitAxisOverlay" src/` returns 0 hits.

## i18n Keys Removed

`moshpit.sort.*` block — 12 keys total:

- sectionLabel, xAxisLabel, yAxisLabel, xAxisPlaceholder, yAxisPlaceholder, clearAxis, axisSetAnnouncement, axisClearedAnnouncement, gridSpacingLabel, gridSpacingValue, gridSpacingDisabledTooltip, showHiddenLabel

## i18n Keys Added

- `moshpit.grouping.spacingValue: "{value}px"` (replacement for `moshpit.sort.gridSpacingValue`)

`moshpit.grouping.spacingLabel` and `moshpit.filters.showHiddenLabel` were already present (added by Plan 04 Task 1 and an earlier plan respectively).

## HUMAN-UAT Verdict — PENDING

User has not yet run 04-HUMAN-UAT.md. D-22 outcome TBD. Phase 5 is blocked on YES verdict.

## D-22 Outcome

PENDING — returning checkpoint to user.

## Follow-up Issues Surfaced

1. **Pre-existing tsconfig mismatch** between main and browser_tests tsconfigs blocks any new `browser_tests/` commits. Not Phase 4 scope but blocks the Task 5 Playwright spec. Documented in deferred-items.md with suggested fix.
2. **Custom save-node surfacing** (Pitfall 3 from RESEARCH): v1 ships with hardcoded output-class set (`SaveImage`, `PreviewImage`, `SaveImageWebsocket`, `SaveAnimatedWEBP`, `SaveImageExtended`). Custom save nodes (user-defined class_types) will fall through to the `(other)` bucket. Dogfood may surface common custom save nodes that should be added to the set.
3. **Cluster-overlay label culling** (RESEARCH OQ 4): labels at depths 0 and 1 may collide when many small clusters appear side-by-side at low zoom. Max-width truncation + depth gating are in place, but full culling behaviour needs dogfood feedback.
4. **Multi-output workflow save-node mismatch** (D-08 v1 limit): workflows with multiple SaveImage nodes emit assets all attributed to the first node in iteration order. If dogfood shows this is misleading, a post-Phase-4 fix in Phase 5 or 7 could use per-asset metadata to pick the emitting node.

## Self-Check: PASSED

Verified via shell tests:

- `[ -f .planning/phases/04-lineage-groupings-within-cluster-sort/04-HUMAN-UAT.md ]` — FOUND
- `[ -f .planning/phases/04-lineage-groupings-within-cluster-sort/04-VALIDATION.md ]` — FOUND
- `[ -f src/platform/moshpit/components/MoshpitSettingsPanel.vue ]` — FOUND (modified)
- `[ -f src/views/MoshpitView.vue ]` — FOUND (modified)
- `[ -f src/platform/moshpit/components/MoshpitGridSpacingControl.vue ]` — FOUND (modified)
- `[ -f src/platform/moshpit/components/MoshpitShowHiddenToggle.vue ]` — FOUND (modified)
- Commits: 2649a98f0, 42467e894, fcbe1a48a, 922832505 — all present in `git log --all`

Tasks 1–6 complete. Task 7 awaits human D-22 verdict.
