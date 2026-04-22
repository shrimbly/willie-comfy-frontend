---
phase: 5
slug: tournament-mode-replaces-old-comparison-mode-framing
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-22
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| **Framework**          | Vitest `^4.0.16` (unit) + Playwright `^1.58.1` (E2E)             |
| **Config file**        | `vite.config.mts` (vitest block), `playwright.config.ts`         |
| **Quick run command**  | `pnpm test:unit -- --run <touched-file>.test.ts`                 |
| **Full suite command** | `pnpm test:unit && pnpm lint && pnpm typecheck && pnpm knip`     |
| **Estimated runtime**  | ~90s (unit+lint+typecheck); Playwright `@moshpit` spec adds ~60s |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit -- --run <touched-file>.test.ts`
- **After every plan wave:** Run `pnpm test:unit && pnpm lint && pnpm typecheck && pnpm knip`
- **Before `/gsd-verify-work`:** Full suite must be green + HUMAN-UAT signed off
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan  | Wave | Requirement                                 | Threat Ref    | Secure Behavior                                                               | Test Type  | Automated Command                                                                                                                                                                                                                                                 | File Exists | Status     |
| ------- | ----- | ---- | ------------------------------------------- | ------------- | ----------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 5-01-01 | 05-01 | 1    | TOUR-02, TOUR-03, TOUR-05, TOUR-06, TOUR-07 | T-05-01-01    | RED fast-check tests fail at missing module (pure-math boundary established)  | unit (RED) | `pnpm test:unit -- --run src/platform/moshpit/services/tournamentBracket.test.ts 2>&1 \| grep -E "(FAIL\|Cannot find module\|is not a function)"`                                                                                                                 | ✅ W0       | ⬜ pending |
| 5-01-02 | 05-01 | 1    | TOUR-02, TOUR-03, TOUR-05, TOUR-06, TOUR-07 | T-05-01-01/04 | GREEN pure bracket module — determinism verified by property tests            | unit       | `pnpm test:unit -- --run src/platform/moshpit/services/tournamentBracket.test.ts`                                                                                                                                                                                 | ✅ W0       | ⬜ pending |
| 5-02-01 | 05-02 | 1    | PEEK-02, PEEK-03                            | T-05-02-01    | RED permutation-invariance + diff-state classification tests                  | unit (RED) | `pnpm test:unit -- --run src/platform/moshpit/services/metadataDiff.test.ts 2>&1 \| grep -E "(FAIL\|Cannot find module)"`                                                                                                                                         | ✅ W0       | ⬜ pending |
| 5-02-02 | 05-02 | 1    | PEEK-02, PEEK-03                            | T-05-02-01    | GREEN diff module — order-insensitive LoRA set diff                           | unit       | `pnpm test:unit -- --run src/platform/moshpit/services/metadataDiff.test.ts`                                                                                                                                                                                      | ✅ W0       | ⬜ pending |
| 5-03-01 | 05-03 | 2    | TOUR-01/03/04/05/06/07/08, PEEK-01          | T-05-03-02/04 | RED store lifecycle tests (enter/exit/pick/skip; no-IDB grep for TOUR-05)     | unit (RED) | `pnpm test:unit -- --run src/platform/moshpit/stores/moshpitTournamentStore.test.ts 2>&1 \| grep -E "(FAIL\|Cannot find module)"`                                                                                                                                 | ✅ W0       | ⬜ pending |
| 5-03-02 | 05-03 | 2    | TOUR-01/03/04/05/06/07/08, PEEK-01          | T-05-03-02/04 | GREEN ephemeral Pinia store (no IDB imports; sidebar capture/restore)         | unit       | `pnpm test:unit -- --run src/platform/moshpit/stores/moshpitTournamentStore.test.ts`                                                                                                                                                                              | ✅ W0       | ⬜ pending |
| 5-03-03 | 05-03 | 2    | TOUR-03, TOUR-04                            | T-05-03-06    | Scoped keydown composable — D-13 keymap with preventDefault+stopPropagation   | unit       | `pnpm test:unit -- --run src/platform/moshpit/composables/useMoshpitTournamentKeybindings.test.ts`                                                                                                                                                                | ✅ W0       | ⬜ pending |
| 5-04-01 | 05-04 | 3    | TOUR-08                                     | T-05-04-01/02 | Thumb fallback + full-res crossfade; no `getObjectUrl` (Pitfall 2)            | unit       | `pnpm test:unit -- --run src/platform/moshpit/components/MoshpitTournamentAssetFrame.test.ts`                                                                                                                                                                     | ✅ W0       | ⬜ pending |
| 5-04-02 | 05-04 | 3    | TOUR-02, TOUR-04                            | T-05-04-02    | Three display modes render reactively; state preserved across mode switch     | unit       | `pnpm test:unit -- --run src/platform/moshpit/components/MoshpitTournamentPair.test.ts`                                                                                                                                                                           | ✅ W0       | ⬜ pending |
| 5-05-01 | 05-05 | 3    | PEEK-01, PEEK-02, PEEK-03                   | T-05-05-01    | Peek panel slide + diff render; XSS-safe interpolation (no v-html)            | unit       | `pnpm test:unit -- --run src/platform/moshpit/components/MoshpitMetadataPeekPanel.test.ts`                                                                                                                                                                        | ✅ W0       | ⬜ pending |
| 5-06-01 | 05-06 | 4    | TOUR-01/02/03/04/05/06/07/08, PEEK-01/02/03 | T-05-06-01    | Reka DialogRoot composition; focus trap (no useFocusTrap); Esc routed to exit | unit       | `pnpm test:unit -- --run src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts`                                                                                                                                                                        | ✅ W0       | ⬜ pending |
| 5-06-02 | 05-06 | 4    | TOUR-01, PEEK-01/02/03                      | T-05-06-01/02 | MoshpitView Enter gate + overlay mount + i18n namespace                       | unit+lint  | `pnpm test:unit -- --run src/views/ src/platform/moshpit/ && pnpm lint src/views/MoshpitView.vue`                                                                                                                                                                 | ✅ W0       | ⬜ pending |
| 5-06-03 | 05-06 | 4    | TOUR-01, TOUR-02, TOUR-07                   | T-05-06-04    | Playwright @moshpit spec OR deferred-items carve-out                          | E2E/doc    | `if [ -f browser_tests/tests/moshpit/moshpit-tournament.spec.ts ]; then pnpm test:browser:local --grep @moshpit; else grep -q "Playwright @moshpit spec deferred" .planning/phases/05-tournament-mode-replaces-old-comparison-mode-framing/deferred-items.md; fi` | ✅ W0       | ⬜ pending |
| 5-06-04 | 05-06 | 4    | D-25 HUMAN-UAT scenarios 1–11               | T-05-06-04/05 | HUMAN-UAT doc authored with 11 scenarios + full suite green                   | doc+suite  | `test -f .planning/phases/05-tournament-mode-replaces-old-comparison-mode-framing/05-HUMAN-UAT.md && grep -c "Scenario" .planning/phases/05-tournament-mode-replaces-old-comparison-mode-framing/05-HUMAN-UAT.md`                                                 | ✅ W0       | ⬜ pending |
| 5-06-05 | 05-06 | 4    | D-25 qualitative sign-off                   | —             | Human verification of tournament end-to-end                                   | checkpoint | `grep -c "^- \[x\] Verified" .planning/phases/05-tournament-mode-replaces-old-comparison-mode-framing/05-HUMAN-UAT.md`                                                                                                                                            | ✅ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `src/platform/moshpit/services/tournamentBracket.test.ts` — covers TOUR-02/05/06/07 (bracket gen + winner set + skip re-queue) — created by Plan 05-01 Task 1 (RED)
- [x] `src/platform/moshpit/services/metadataDiff.test.ts` — covers PEEK-02/03 (diff + LoRA set-diff permutation-invariance) — created by Plan 05-02 Task 1 (RED)
- [x] `src/platform/moshpit/stores/moshpitTournamentStore.test.ts` — covers TOUR-01/03/04/05/06/07/08 + PEEK-01 — created by Plan 05-03 Task 1 (RED)
- [x] `src/platform/moshpit/composables/useMoshpitTournamentKeybindings.test.ts` — covers TOUR-03/04 keymap — created by Plan 05-03 Task 3 (RED+GREEN)
- [x] `src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts` — covers TOUR-02 mounting + PEEK-01 default — created by Plan 05-06 Task 1
- [x] `src/platform/moshpit/components/MoshpitTournamentPair.test.ts` — covers TOUR-02/04 three display modes — created by Plan 05-04 Task 2
- [x] `src/platform/moshpit/components/MoshpitTournamentAssetFrame.test.ts` — covers TOUR-08 thumb fallback + crossfade — created by Plan 05-04 Task 1
- [x] `src/platform/moshpit/components/MoshpitMetadataPeekPanel.test.ts` — covers PEEK-01/02/03 panel render + diff states — created by Plan 05-05 Task 1
- [x] `browser_tests/tests/moshpit/moshpit-tournament.spec.ts` — Playwright `@moshpit` E2E for TOUR-01/02/07 — created (or formally deferred via `deferred-items.md`) by Plan 05-06 Task 3. **Path locked:** `browser_tests/tests/moshpit/moshpit-tournament.spec.ts` (matches existing `moshpit/` subdirectory precedent set by `moshpit-shell.spec.ts`).
- [x] `.planning/phases/05-tournament-mode-replaces-old-comparison-mode-framing/05-HUMAN-UAT.md` — qualitative sign-off per D-25 — created by Plan 05-06 Task 4
- [x] Framework install: none — all deps already present.

---

## Manual-Only Verifications

| Behavior                                             | Requirement | Why Manual                | Test Instructions                       |
| ---------------------------------------------------- | ----------- | ------------------------- | --------------------------------------- |
| "Tournament feels faster than scrolling" qualitative | HUMAN-UAT   | Subjective / perceptual   | See `05-HUMAN-UAT.md` scenarios 1–11    |
| Full-res crossfade smoothness at 60fps               | TOUR-08     | GPU-bound perception      | Manual dogfood with large selection     |
| Peek panel legibility vs background                  | PEEK-01/02  | Visual contrast judgement | Manual review across light/dark renders |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
