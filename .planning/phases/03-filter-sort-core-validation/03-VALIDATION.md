---
phase: 3
slug: filter-sort-core-validation
status: deferred-until-plan-11
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

> **Interim state — `status: deferred-until-plan-11`:** Plans 03-01 through 03-10 each carry their own `<verify>` automated commands and acceptance criteria; the Per-Task Verification Map below is populated in a single batch during Plan 03-11 Task 2. Agents running Plans 01..10 should treat `nyquist_compliant: false` as "validation deferred, not a gap." Plan 03-11 flips the frontmatter to `status: active`, `nyquist_compliant: true`, and `wave_0_complete: true` after the map is populated and sampled.

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (unit/component) + Playwright 1.58.x (E2E) |
| **Config file** | `vite.config.mts` (vitest block) / `playwright.config.ts` |
| **Quick run command** | `pnpm test:unit -- <file>` |
| **Full suite command** | `pnpm test:unit && pnpm typecheck && pnpm lint` |
| **Estimated runtime** | ~90 seconds (unit+typecheck+lint); E2E on demand |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit -- <affected file>` + `pnpm typecheck`
- **After every plan wave:** Run `pnpm test:unit && pnpm typecheck && pnpm lint`
- **Before `/gsd-verify-work`:** Full suite green + targeted Playwright spec green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | FILTER-01..11, SORT-01..05 | — | N/A (visual-only client surface) | unit/e2e | `pnpm test:unit -- <file>` | ❌ W0 | ⬜ pending |

*Populated by planner. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Normalized-params pure-function test stubs (FILTER-01..11, SORT-01..05 target signatures)
- [ ] Filter store/composable test harness (Pinia test context)
- [ ] PixiJS sort-layout pure-function stubs (1D-with-packing, 2D scatter)
- [ ] Playwright spec scaffold for workflow+time gate flow (`browser_tests/tests/moshpit/phase-03-filter-sort.spec.ts`)

*Existing vitest + Playwright infrastructure covers the runtime; only new test files are needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Parameter sweep visible legibility | SORT-01..05 (success criterion 5) | Subjective — "visibly legible spatial arrangement" on real 5k sweep | Run real CFG sweep workflow; confirm X-axis spread is readable and grid-snap does not collide |
| 60fps pan/zoom under filter+sort load | performance budget | Requires real-device frame-time sampling | Chrome Performance tab on 5k dataset + active sort; confirm no dropped frames |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
