---
phase: 04
slug: lineage-groupings-within-cluster-sort
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (unit/component, happy-dom) + Playwright 1.58.x (E2E) |
| **Config file** | `vite.config.mts` (test block); `playwright.config.ts` |
| **Quick run command** | `pnpm test:unit -- src/<area>` (scoped to phase files) |
| **Full suite command** | `pnpm test:unit && pnpm typecheck && pnpm lint` |
| **Estimated runtime** | ~30–60 seconds (unit+typecheck+lint); Playwright excluded from per-commit loop |

---

## Sampling Rate

- **After every task commit:** Run scoped `pnpm test:unit -- <paths>` for touched files
- **After every plan wave:** Run `pnpm test:unit && pnpm typecheck && pnpm lint`
- **Before `/gsd-verify-work`:** Full suite + relevant Playwright specs must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD — planner fills | TBD | TBD | GROUP-01..10, CSORT-01, FILTER-12 | — | N/A (client-only, no new network surface) | unit/component/e2e | `pnpm test:unit -- <path>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Planner MUST expand this table row-per-task with real task IDs, plan numbers, waves, REQ IDs, file paths, and concrete `pnpm test:unit -- <path>` commands.

---

## Wave 0 Requirements

- [ ] `src/workbench/moshpit/composables/clusterLayout.test.ts` — pure-function tests for cluster tree builder, nesting-order derivation, "(other)" bucket fallthrough (GROUP-01..07)
- [ ] `src/workbench/moshpit/composables/useMoshpitFilteredAssets.test.ts` — integration test that cluster-layout path produces expected sprite coordinates (GROUP-08..10, CSORT-01)
- [ ] `src/workbench/moshpit/components/SettingsPanel/GroupingControls.test.ts` — @testing-library/vue behavioral test for pill toggles + within-cluster sort dropdown (GROUP-01, CSORT-01)
- [ ] `src/workbench/moshpit/components/SettingsPanel/FilterSurface.test.ts` — lineage-primary vs Advanced disclosure behavior (FILTER-12)
- [ ] `browser_tests/tests/moshpit/lineage-groupings.spec.ts` — Playwright golden path: toggle groupings → clusters appear → within-cluster sort changes order (GROUP-01..10)

*All exact paths are planner-authoritative. Planner MUST adjust to match actual Moshpit directory structure surfaced in RESEARCH.md (section on existing architecture).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| <400ms animated transition at 5k assets | GROUP-01 / SC#1 | Wall-clock perception; Playwright can time transition but feel is subjective | Load 5k-asset dogfood dataset, toggle a grouping axis, confirm transition feels responsive (<400ms). Record timing via PixiJS ticker profiler. |
| Deterministic nesting-order tie-break visually correct | GROUP-02 / SC#2 | Visual inspection of nested cluster layout | Enable 3+ axes on real data, confirm outermost = largest-average-bucket axis, applied recursively |
| "(other)" cluster reads intuitively | GROUP-03 / SC#3 | UX judgment | Load dataset with partial metadata, confirm orphaned assets appear in labelled "(other)" bucket, not hidden |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references above
- [ ] No watch-mode flags (no `vitest --watch`, no `playwright --ui`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills the verification map

**Approval:** pending
