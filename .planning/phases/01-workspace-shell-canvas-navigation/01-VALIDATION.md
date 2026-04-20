---
phase: 1
slug: workspace-shell-canvas-navigation
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-20
planning_completed: 2026-04-20
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

> Every task has a row linking Task ID → automated test command.
> Task `1-01-01` is the regression-pinning harness (D-08 gate) that must land BEFORE the extraction in `1-01-03`.

| Task ID | Plan | Wave | Requirement                    | Threat Ref       | Secure Behavior                           | Test Type | Automated Command                                                                                                                                        | File Exists | Status     |
| ------- | ---- | ---- | ------------------------------ | ---------------- | ----------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 1-01-01 | 01   | 1    | NAV-01..05, SHELL-03           | T-01-02          | Regression safety net for extraction      | unit      | `pnpm test:unit -- src/renderer/core/canvas/useCanvasInteractions.test.ts --reporter=dot`                                                                | 🔁 extend   | ⬜ pending |
| 1-01-02 | 01   | 1    | NAV-01..05, SHELL-03           | T-01-03          | Layer-boundary isolation                  | unit      | `pnpm test:unit -- src/composables/canvas/useCanvasInput.test.ts --reporter=dot && pnpm lint -- src/composables/canvas/useCanvasInput.ts`                | ❌ new      | ⬜ pending |
| 1-01-03 | 01   | 1    | NAV-01..05, SHELL-03           | T-01-02          | Public-API stability                      | unit      | `pnpm test:unit -- src/renderer/core/canvas/useCanvasInteractions.test.ts src/composables/canvas/useCanvasInput.test.ts --reporter=dot`                  | ✅          | ⬜ pending |
| 1-02-01 | 02   | 1    | SHELL-01, SHELL-02, SHELL-05   | T-02-01..02      | Cloud auth guard + keep-alive match       | typecheck | `pnpm typecheck && pnpm lint -- src/router.ts src/App.vue src/views/GraphView.vue`                                                                       | ✅          | ⬜ pending |
| 1-02-02 | 02   | 1    | SHELL-01, SHELL-02             | T-02-03          | No workflow-store leak into MoshpitLayout | typecheck | `pnpm typecheck && pnpm lint -- src/views/layouts/MoshpitLayout.vue src/views/MoshpitView.vue src/composables/useCoreCommands.ts`                        | ❌ new      | ⬜ pending |
| 1-03-01 | 03   | 2    | SHELL-03, SHELL-04             | T-03-02          | Serialization-safe store shape            | unit      | `pnpm test:unit -- src/platform/moshpit/stores --reporter=dot`                                                                                           | ❌ new      | ⬜ pending |
| 1-03-02 | 03   | 2    | SHELL-02, SHELL-03, NAV-01..02 | T-03-01          | Pixi lifecycle cleanup                    | unit      | `pnpm test:unit -- src/platform/moshpit --reporter=dot`                                                                                                  | ❌ new      | ⬜ pending |
| 1-04-01 | 04   | 3    | NAV-03, NAV-04                 | T-04-03          | Marquee document-listener cleanup         | unit      | `pnpm test:unit -- src/platform/moshpit/composables/useMoshpitMarquee.test.ts --reporter=dot`                                                            | ❌ new      | ⬜ pending |
| 1-04-02 | 04   | 3    | NAV-02, NAV-05                 | T-04-01..02      | Keybinding DOM-scope check                | unit      | `pnpm test:unit -- src/composables/useMoshpitCommands.test.ts --reporter=dot && grep -q 'moshpit-canvas-container' src/platform/keybindings/defaults.ts` | ❌ new      | ⬜ pending |
| 1-04-03 | 04   | 3    | NAV-02..05, SHELL-04           | —                | Focus-on-click for keybinding scoping     | unit      | `pnpm typecheck && pnpm test:unit -- src/platform/moshpit --reporter=dot`                                                                                | ✅          | ⬜ pending |
| 1-05-01 | 05   | 3    | SHELL-04                       | —                | No `dark:`/`!important` in chrome         | lint      | `pnpm typecheck && pnpm lint -- src/platform/moshpit/components src/views/layouts/MoshpitLayout.vue`                                                     | ❌ new      | ⬜ pending |
| 1-05-02 | 05   | 3    | SHELL-04                       | T-05-02          | Pinia-isolated stories                    | lint      | `pnpm typecheck && pnpm lint -- src/platform/moshpit/components/MoshpitSideRail.stories.ts src/views/layouts/MoshpitLayout.stories.ts`                   | ❌ new      | ⬜ pending |
| 1-05-03 | 05   | 3    | SHELL-04, SHELL-05             | T-05-01, T-05-03 | Keep-alive regression + D-11 latch        | E2E       | `pnpm test:browser:local -- --grep @moshpit`                                                                                                             | ❌ new      | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `src/renderer/core/canvas/useCanvasInteractions.test.ts` — regression fixtures pinning pan/zoom/marquee in both standard AND legacy nav modes — covered by Task 1-01-01 (D-08)
- [x] `src/composables/canvas/useCanvasInput.test.ts` — tests for the pure composable — covered by Task 1-01-02
- [x] `browser_tests/tests/moshpit/` — `@moshpit`-tagged specs with `MoshpitCanvasHelper` — covered by Task 1-05-03
- [x] `pnpm add pixi.js@^8.18 pixi-viewport@^6.0` — covered by Task 1-02-01

All Wave 0 gaps are now addressed by concrete tasks above.

---

## Manual-Only Verifications

| Behavior                                                | Requirement | Why Manual                                         | Test Instructions                                                                               |
| ------------------------------------------------------- | ----------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Pan/zoom "feels indistinguishable" from workflow canvas | NAV-01..04  | Subjective feel can't be asserted programmatically | Human dogfood: open `/moshpit`, open `/`, confirm inertia/clamp/wheel-speed match               |
| Settings panel auto-collapse animation timing           | SHELL-04    | Transition perception                              | Human: enter `/moshpit`, click empty canvas, confirm panel collapses smoothly                   |
| Storybook visual review of MoshpitSideRail + Layout     | SHELL-04    | Storybook visual parity with SideToolbar           | Run `pnpm storybook`, open `platform/moshpit/MoshpitSideRail` and `views/layouts/MoshpitLayout` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has one)
- [x] Wave 0 gaps mapped to concrete tasks
- [x] No watch-mode flags (all commands are one-shot)
- [x] Feedback latency < 90s (scoped unit for every task; full Playwright reserved for task 1-05-03)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution — pending Wave 0 task 1-01-01 landing first.
