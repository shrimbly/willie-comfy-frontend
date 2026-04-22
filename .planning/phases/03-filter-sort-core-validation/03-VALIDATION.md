---
phase: 3
slug: filter-sort-core-validation
status: active
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
updated: 2026-04-21
---

> **Interim state resolved — `status: active`:** Plans 03-01 through 03-10 each carried their own `<verify>` automated commands and acceptance criteria; the Per-Task Verification Map below was populated in a single batch during Plan 03-11 Task 2. The original interim state was `status: deferred-until-plan-11` / `nyquist_compliant: false` — this is now resolved.

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                     |
| ---------------------- | --------------------------------------------------------- |
| **Framework**          | vitest 4.x (unit/component) + Playwright 1.58.x (E2E)     |
| **Config file**        | `vite.config.mts` (vitest block) / `playwright.config.ts` |
| **Quick run command**  | `pnpm test:unit -- <file>`                                |
| **Full suite command** | `pnpm test:unit && pnpm typecheck && pnpm lint`           |
| **Estimated runtime**  | ~90 seconds (unit+typecheck+lint); E2E on demand          |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit -- <affected file>` + `pnpm typecheck`
- **After every plan wave:** Run `pnpm test:unit && pnpm typecheck && pnpm lint`
- **Before `/gsd-verify-work`:** Full suite green + targeted Playwright spec green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                                                                             | Threat Ref             | Test Type | Automated Command                                                                     | File Exists | Status |
| -------- | ---- | ---- | --------------------------------------------------------------------------------------- | ---------------------- | --------- | ------------------------------------------------------------------------------------- | ----------- | ------ |
| 03-01-T1 | 01   | 1    | FILTER-09                                                                               | —                      | unit      | `pnpm test:unit -- paramNormalize.test.ts`                                            | ✅          | ✅     |
| 03-01-T2 | 01   | 1    | FILTER-09                                                                               | —                      | unit      | `pnpm test:unit -- paramNormalize.test.ts`                                            | ✅          | ✅     |
| 03-02-T1 | 02   | 1    | FILTER-01, FILTER-08                                                                    | T-03-02-01, T-03-02-02 | unit      | `pnpm test:unit -- filterMath.test.ts`                                                | ✅          | ✅     |
| 03-02-T2 | 02   | 1    | FILTER-06, FILTER-07                                                                    | —                      | unit      | `pnpm test:unit -- filterMath.test.ts`                                                | ✅          | ✅     |
| 03-03-T1 | 03   | 1    | SORT-01, SORT-02, SORT-03                                                               | T-03-03-01             | unit      | `pnpm test:unit -- sortMath.test.ts`                                                  | ✅          | ✅     |
| 03-03-T2 | 03   | 1    | SORT-04, SORT-05                                                                        | —                      | unit      | `pnpm test:unit -- sortMath.test.ts`                                                  | ✅          | ✅     |
| 03-04-T1 | 04   | 2    | FILTER-02, FILTER-03, FILTER-04, FILTER-05                                              | —                      | unit      | `pnpm test:unit -- moshpitCurationStore.test.ts`                                      | ✅          | ✅     |
| 03-04-T2 | 04   | 2    | FILTER-02, FILTER-03                                                                    | —                      | unit      | `pnpm test:unit -- moshpitCurationStore.test.ts`                                      | ✅          | ✅     |
| 03-05-T1 | 05   | 2    | FILTER-09                                                                               | T-03-05-01, T-03-05-02 | unit      | `pnpm test:unit -- moshpitMetadataStore.test.ts`                                      | ✅          | ✅     |
| 03-05-T2 | 05   | 2    | FILTER-09                                                                               | —                      | unit      | `pnpm test:unit -- moshpitMetadataStore.test.ts`                                      | ✅          | ✅     |
| 03-06-T1 | 06   | 4    | FILTER-01, FILTER-10, FILTER-11                                                         | —                      | unit      | `pnpm test:unit -- moshpitFilterStore.test.ts`                                        | ✅          | ✅     |
| 03-06-T2 | 06   | 4    | FILTER-08, SORT-01, SORT-02, SORT-03, SORT-04, SORT-05                                  | —                      | unit      | `pnpm test:unit -- useMoshpitFilteredAssets.test.ts`                                  | ✅          | ✅     |
| 03-07-T1 | 07   | 2    | FILTER-01, FILTER-06                                                                    | T-03-07-01, T-03-07-02 | unit      | `pnpm test:unit -- useMoshpitWorkflowOptions.test.ts`                                 | ✅          | ✅     |
| 03-07-T2 | 07   | 2    | FILTER-01                                                                               | —                      | unit      | `pnpm test:unit -- MoshpitWorkflowPicker.test.ts`                                     | ✅          | ✅     |
| 03-07-T3 | 07   | 2    | FILTER-06                                                                               | T-03-07-01             | unit      | `pnpm test:unit -- MoshpitTimeRangePicker.test.ts`                                    | ✅          | ✅     |
| 03-08-T1 | 08   | 3    | FILTER-10, FILTER-08                                                                    | —                      | unit      | `pnpm test:unit -- MoshpitFilterChipRow.test.ts`                                      | ✅          | ✅     |
| 03-08-T2 | 08   | 3    | FILTER-10                                                                               | —                      | unit      | `pnpm test:unit -- MoshpitAddFilterPopover.test.ts`                                   | ✅          | ✅     |
| 03-08-T3 | 08   | 3    | FILTER-07, FILTER-08                                                                    | —                      | unit      | `pnpm test:unit -- Moshpit*FilterEditor.test.ts`                                      | ✅          | ✅     |
| 03-09-T1 | 09   | 3    | SORT-01, SORT-02                                                                        | —                      | unit      | `pnpm test:unit -- MoshpitSortControls.test.ts`                                       | ✅          | ✅     |
| 03-09-T2 | 09   | 3    | SORT-04, FILTER-11                                                                      | —                      | unit      | `pnpm test:unit -- MoshpitGridSpacingControl.test.ts MoshpitShowHiddenToggle.test.ts` | ✅          | ✅     |
| 03-10-T1 | 10   | 3    | SORT-01, SORT-02, SORT-05                                                               | T-03-10-01, T-03-10-02 | unit      | `pnpm test:unit -- MoshpitAxisOverlay.test.ts`                                        | ✅          | ✅     |
| 03-10-T2 | 10   | 3    | SORT-01, SORT-02                                                                        | —                      | unit      | `pnpm test:unit -- MoshpitAxisOverlay.test.ts`                                        | ✅          | ✅     |
| 03-11-T1 | 11   | 4    | FILTER-01, FILTER-08, FILTER-10, FILTER-11, SORT-01, SORT-02, SORT-03, SORT-04, SORT-05 | T-03-11-01, T-03-11-02 | unit      | `pnpm test:unit -- MoshpitSettingsPanel.test.ts MoshpitEmptyGateOverlay.test.ts`      | ✅          | ✅     |
| 03-11-T2 | 11   | 4    | FILTER-01, FILTER-08, FILTER-11, SORT-01                                                | —                      | e2e       | `pnpm test:browser:local -- --grep "@moshpit"`                                        | ✅          | ✅     |
| 03-11-T3 | 11   | 4    | All 16 requirements                                                                     | —                      | human-uat | See 03-HUMAN-UAT.md Scenarios 1, 2, 3                                                 | ✅          | ⬜     |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements — RESOLVED

All Wave 0 gaps from the original VALIDATION.md are closed:

- [x] Normalized-params pure-function test stubs — `paramNormalize.test.ts` (Plan 03-01)
- [x] Filter store/composable test harness — `moshpitFilterStore.test.ts`, `useMoshpitFilteredAssets.test.ts` (Plan 03-06)
- [x] PixiJS sort-layout pure-function stubs — `sortMath.test.ts` (Plan 03-03)
- [x] Playwright spec scaffold — `phase-03-filter-sort.spec.ts` (Plan 03-11)

---

## Manual-Only Verifications

| Behavior                              | Requirement                       | Why Manual                                                          | Test Instructions                                                                             |
| ------------------------------------- | --------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Parameter sweep visible legibility    | SORT-01..05 (success criterion 5) | Subjective — "visibly legible spatial arrangement" on real 5k sweep | Run real CFG sweep workflow; confirm X-axis spread is readable and grid-snap does not collide |
| 60fps pan/zoom under filter+sort load | performance budget                | Requires real-device frame-time sampling                            | Chrome Performance tab on 5k dataset + active sort; confirm no dropped frames                 |
| CFG sweep sort primary question       | Core Value (D-22)                 | Qualitative human judgment                                          | See 03-HUMAN-UAT.md Scenario 1 — YES/SORT OF/NO sign-off required                             |
| 2D scatter grid coherence             | SORT-02, SORT-05                  | Qualitative — sparse-cell handling subjective                       | See 03-HUMAN-UAT.md Scenario 2                                                                |
| Filter chip tween smoothness          | FILTER-10, D-18                   | Requires real animation frame observation                           | See 03-HUMAN-UAT.md Scenario 3                                                                |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Phase 3 automated validation complete. Human UAT (Task 3) pending sign-off.
