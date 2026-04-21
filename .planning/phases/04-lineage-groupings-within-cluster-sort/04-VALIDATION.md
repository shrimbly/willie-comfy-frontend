---
phase: 04
slug: lineage-groupings-within-cluster-sort
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| **Framework**          | vitest 4.x (unit/component, happy-dom) + Playwright 1.58.x (E2E)               |
| **Config file**        | `vite.config.mts` (test block); `playwright.config.ts`                         |
| **Quick run command**  | `pnpm test:unit -- src/platform/moshpit/<path>` (scoped to phase files)        |
| **Full suite command** | `pnpm test:unit && pnpm typecheck && pnpm lint`                                |
| **Estimated runtime**  | ~30–60 seconds (unit+typecheck+lint); Playwright excluded from per-commit loop |

---

## Sampling Rate

- **After every task commit:** Run scoped `pnpm test:unit -- <paths>` for touched files
- **After every plan wave:** Run `pnpm test:unit && pnpm typecheck && pnpm lint`
- **Before `/gsd-verify-work`:** Full suite + relevant Playwright specs must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement                      | Threat Ref | Secure Behavior                          | Test Type       | Automated Command                                                                                                                                                             | File Exists | Status      |
| ------- | ---- | ---- | -------------------------------- | ---------- | ---------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- |
| 01-T1   | 01   | 1    | GROUP-02/03/05/06/07/08/CSORT-01 | —          | Pure math, worker-safe, no network       | unit            | `pnpm test:unit -- src/platform/moshpit/services/groupAxes.test.ts --run`                                                                                                     | ✅ W0       | ✅ green    |
| 01-T2   | 01   | 1    | GROUP-02/08/10                   | T-04-01-02 | Memoised bucket-key; <100ms @ 5k         | unit            | `pnpm test:unit -- src/platform/moshpit/services/clusterLayout.test.ts --run`                                                                                                 | ✅ W0       | ✅ green    |
| 02-T1   | 02   | 1    | GROUP-04                         | —          | Best-effort extraction; null on miss     | unit            | `pnpm test:unit -- src/platform/moshpit/services/paramNormalize.test.ts --run`                                                                                                | ✅ extend   | ✅ green    |
| 02-T2   | 02   | 1    | GROUP-04                         | T-04-02-01 | Per-record try/catch; cursor streaming   | unit            | `pnpm test:unit -- src/platform/moshpit/services/thumbRepository.test.ts --run`                                                                                               | ✅ extend   | ✅ green    |
| 03-T1   | 03   | 2    | FILTER-12                        | T-04-03-01 | Exhaustive-never default                 | unit            | `pnpm test:unit -- src/platform/moshpit/services/filterMath.test.ts --run`                                                                                                    | ✅ extend   | ✅ green    |
| 03-T2   | 03   | 2    | GROUP-01/CSORT-01                | —          | Store-level state; no new trust boundary | unit            | `pnpm test:unit -- src/platform/moshpit/stores/moshpitFilterStore.test.ts --run`                                                                                              | ✅ extend   | ✅ green    |
| 03-T3   | 03   | 2    | GROUP-01/09/CSORT-01             | T-04-03-02 | Memoised auto-nest computed              | integration     | `pnpm test:unit -- src/platform/moshpit/composables/useMoshpitFilteredAssets.test.ts --run`                                                                                   | ✅ extend   | ✅ green    |
| 03-T4   | 03   | 2    | GROUP-01/CSORT-01                | —          | Mandatory deletion keeps typecheck green | build           | `pnpm typecheck && [ ! -f src/platform/moshpit/components/MoshpitSortControls.vue ]`                                                                                          | ✅ existing | ✅ green    |
| 04-T1   | 04   | 3    | GROUP-01                         | T-04-04-01 | Interpolation-only rendering             | component       | `pnpm test:unit -- src/platform/moshpit/components/MoshpitGroupingToggles.test.ts --run`                                                                                      | ✅ W0       | ✅ green    |
| 04-T2   | 04   | 3    | CSORT-01                         | —          | Native select; a11y via label for=       | component       | `pnpm test:unit -- src/platform/moshpit/components/MoshpitWithinClusterSort.test.ts --run`                                                                                    | ✅ W0       | ✅ green    |
| 04-T3   | 04   | 3    | FILTER-12                        | T-04-04-02 | Controlled Reka Collapsible              | component       | `pnpm test:unit -- src/platform/moshpit/components/MoshpitAdvancedFilters.test.ts --run`                                                                                      | ✅ W0       | ✅ green    |
| 04-T4   | 04   | 3    | FILTER-12                        | —          | Tier-filtered chip rendering             | component       | `pnpm test:unit -- src/platform/moshpit/components/MoshpitFilterChipRow.test.ts src/platform/moshpit/components/MoshpitAddFilterPopover.test.ts --run`                        | ✅ extend   | ✅ green    |
| 05-T1   | 05   | 3    | GROUP-01/02                      | T-04-05-01 | Template interpolation only              | component       | `pnpm test:unit -- src/platform/moshpit/components/MoshpitClusterOverlay.test.ts --run`                                                                                       | ✅ W0       | ✅ green    |
| 06-T1   | 06   | 4    | GROUP-01/CSORT-01/FILTER-12      | —          | Layout-order assertions                  | component       | `pnpm test:unit -- src/platform/moshpit/components/MoshpitSettingsPanel.test.ts --run`                                                                                        | ✅ extend   | ✅ green    |
| 06-T2   | 06   | 4    | GROUP-01/02                      | —          | Overlay mount in MoshpitView             | component       | `pnpm test:unit -- src/views/MoshpitView.test.ts --run`                                                                                                                       | ✅ extend   | ✅ green    |
| 06-T3   | 06   | 4    | — (verification + i18n)          | T-04-06-01 | Portable `[ ! -f ]` tests + i18n removal | build           | `[ ! -f src/platform/moshpit/components/MoshpitSortControls.vue ] && pnpm typecheck && pnpm knip`                                                                             | —           | ✅ green    |
| 06-T4   | 06   | 4    | FILTER-12                        | —          | Label migration to moshpit.grouping.\*   | component/build | `pnpm test:unit -- src/platform/moshpit/components/MoshpitGridSpacingControl.test.ts src/platform/moshpit/components/MoshpitShowHiddenToggle.test.ts --run && pnpm typecheck` | ✅ existing | ✅ green    |
| 06-T5   | 06   | 4    | GROUP-01/FILTER-12               | T-04-06-03 | @moshpit UI smoke                        | e2e             | `pnpm exec playwright test --project=chromium --grep @moshpit`                                                                                                                | ❌ deferred | ⚠️ deferred |
| 06-T6   | 06   | 4    | All (gate)                       | —          | D-22 qualitative gate                    | manual          | see 04-HUMAN-UAT.md                                                                                                                                                           | ✅ W0       | ⬜ pending  |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/deferred_

**Task 06-T5 deferral note:** Pre-existing `typecheck:browser` failures on `main` block new `browser_tests/` commits. Documented in `deferred-items.md`. Best-effort per D-21 — does NOT gate Phase 4 acceptance.

---

## Wave 0 Requirements

- [x] `src/platform/moshpit/services/clusterLayout.test.ts` — cluster tree builder, nesting-order derivation, "(other)" bucket fallthrough (GROUP-01..07) — **shipped in Plan 04-01**
- [x] `src/platform/moshpit/services/groupAxes.test.ts` — axis extraction + within-cluster comparator (GROUP-02/03/05/06/07/08, CSORT-01) — **shipped in Plan 04-01**
- [x] `src/platform/moshpit/composables/useMoshpitFilteredAssets.test.ts` — cluster-layout path produces expected sprite coordinates (GROUP-08..10, CSORT-01) — **extended in Plan 04-03**
- [x] `src/platform/moshpit/components/MoshpitGroupingToggles.test.ts` — pill toggles (GROUP-01) — **shipped in Plan 04-04**
- [x] `src/platform/moshpit/components/MoshpitWithinClusterSort.test.ts` — within-cluster sort dropdown (CSORT-01) — **shipped in Plan 04-04**
- [x] `src/platform/moshpit/components/MoshpitAdvancedFilters.test.ts` — lineage-primary vs Advanced disclosure (FILTER-12) — **shipped in Plan 04-04**
- [x] `src/platform/moshpit/components/MoshpitClusterOverlay.test.ts` — cluster bounding boxes + labels (GROUP-01/02) — **shipped in Plan 04-05**
- [ ] `browser_tests/tests/moshpit/lineage-groupings.spec.ts` — Playwright smoke: grouping toggles + advanced disclosure + cluster overlay presence (GROUP-01, FILTER-12) — **deferred per D-21 + pre-existing typecheck:browser blocker; see `deferred-items.md`**

---

## Manual-Only Verifications

| Behavior                                               | Requirement      | Why Manual                                                        | Test Instructions                                                                                                                     |
| ------------------------------------------------------ | ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| <400ms animated transition at 5k assets                | GROUP-01 / SC#1  | Wall-clock perception; Playwright can time but feel is subjective | Load 5k-asset dogfood dataset, toggle a grouping axis, confirm transition feels responsive (<400ms). See 04-HUMAN-UAT step 4.         |
| Deterministic nesting-order tie-break visually correct | GROUP-02 / SC#2  | Visual inspection of nested cluster layout                        | Enable 3+ axes on real data, confirm outermost = largest-average-bucket axis, applied recursively. See 04-HUMAN-UAT step 4.           |
| "(other)" cluster reads intuitively                    | GROUP-03 / SC#3  | UX judgment                                                       | Load dataset with partial metadata, confirm orphaned assets appear in labelled "(other)" bucket, not hidden. See 04-HUMAN-UAT step 4. |
| D-22 Core Value sign-off (gate)                        | All Phase 4 reqs | Qualitative — the whole v3 pivot hinges on this being "Yes"       | Complete 04-HUMAN-UAT.md end-to-end; sign off YES / SORT OF / NO. `No`/`Sort of` PAUSES Phase 5.                                      |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (Task 06-T6 is explicitly manual; Task 06-T5 deferred per D-21)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references above
- [x] No watch-mode flags (no `vitest --watch`, no `playwright --ui`)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** draft — pending D-22 human sign-off via 04-HUMAN-UAT.md
