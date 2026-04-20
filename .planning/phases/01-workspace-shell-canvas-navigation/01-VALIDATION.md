---
phase: 1
slug: workspace-shell-canvas-navigation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| **Framework**          | Vitest 4.x (unit/component, happy-dom) + Playwright 1.58.x (E2E, browser_tests) |
| **Config file**        | `vite.config.mts` (vitest block), `playwright.config.ts`                        |
| **Quick run command**  | `pnpm test:unit -- src/composables/canvas src/platform/moshpit`                 |
| **Full suite command** | `pnpm test:unit && pnpm test:browser:local -- --grep @moshpit`                  |
| **Estimated runtime**  | ~90s unit, ~180s E2E subset                                                     |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit -- <scoped path>` for the files touched.
- **After every plan wave:** Run full unit suite + scoped Playwright (`@moshpit` tag).
- **Before `/gsd-verify-work`:** Full suite must be green; full Playwright E2E must be green.
- **Max feedback latency:** 10s for scoped unit, 90s for wave-level.

---

## Per-Task Verification Map

> Filled during planning. Each planned task must have a row here linking Task ID → test command.
> Wave 0 of Plan 01 installs the regression-pinning harness that prevents the litegraph extraction from breaking existing behaviour (D-08).

| Task ID | Plan  | Wave | Requirement              | Threat Ref | Secure Behavior | Test Type | Automated Command                                                       | File Exists | Status     |
| ------- | ----- | ---- | ------------------------ | ---------- | --------------- | --------- | ----------------------------------------------------------------------- | ----------- | ---------- |
| _TBD_   | _TBD_ | 0    | SHELL-01..05, NAV-01..05 | —          | N/A             | unit      | `pnpm test:unit src/renderer/core/canvas/useCanvasInteractions.test.ts` | ❌ W0       | ⬜ pending |

_Planner fills per-task rows. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `src/renderer/core/canvas/useCanvasInteractions.test.ts` — extend with regression fixtures pinning current pan/zoom/marquee behaviour in both standard AND legacy nav modes (D-08)
- [ ] `src/composables/canvas/useCanvasInput.test.ts` — stubs for the pure composable split
- [ ] `browser_tests/tests/moshpit/` — add directory with `@moshpit`-tagged specs and a shared `moshpitPage` fixture
- [ ] `pnpm add pixi.js@^8.18 pixi-viewport@^6.0` — install renderer deps (Wave 0 of Plan 02)

---

## Manual-Only Verifications

| Behavior                                                | Requirement | Why Manual                                         | Test Instructions                                                                 |
| ------------------------------------------------------- | ----------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| Pan/zoom "feels indistinguishable" from workflow canvas | NAV-01..04  | Subjective feel can't be asserted programmatically | Human dogfood: open `/moshpit`, open `/`, confirm inertia/clamp/wheel-speed match |
| Settings panel auto-collapse animation timing           | SHELL-04    | Transition perception                              | Human: enter `/moshpit`, click empty canvas, confirm panel collapses smoothly     |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (regression harness + moshpit fixture + pixi install)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
