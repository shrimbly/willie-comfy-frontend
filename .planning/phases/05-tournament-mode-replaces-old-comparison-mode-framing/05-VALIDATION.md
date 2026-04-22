---
phase: 5
slug: tournament-mode-replaces-old-comparison-mode-framing
status: draft
nyquist_compliant: false
wave_0_complete: false
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

> Task IDs will be populated by the planner. Row template follows.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ---------- | --------------- | --------- | ----------------- | ----------- | ---------- |
| 5-XX-YY | XX   | N    | TOUR-/PEEK- | T-5-XX / — | {behavior}      | unit/E2E  | `{command}`       | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `src/platform/moshpit/services/tournamentBracket.test.ts` — covers TOUR-02/06/07 (bracket gen + scoring)
- [ ] `src/platform/moshpit/services/metadataDiff.test.ts` — covers PEEK-02/03 (diff + LoRA set-diff)
- [ ] `src/platform/moshpit/stores/moshpitTournamentStore.test.ts` — covers TOUR-01/03/04/05/06/07/08
- [ ] `src/platform/moshpit/composables/useMoshpitTournamentKeybindings.test.ts` — covers TOUR-03/04
- [ ] `src/platform/moshpit/components/MoshpitTournamentOverlay.test.ts` — covers TOUR-02 mounting, PEEK-01
- [ ] `src/platform/moshpit/components/MoshpitTournamentPair.test.ts` — covers TOUR-02/04 display modes
- [ ] `src/platform/moshpit/components/MoshpitTournamentAssetFrame.test.ts` — covers TOUR-08 loading fallback
- [ ] `src/platform/moshpit/components/MoshpitMetadataPeekPanel.test.ts` — covers PEEK-01/02
- [ ] `browser_tests/tests/moshpit-tournament.spec.ts` — Playwright `@moshpit` E2E (TOUR-01/07)
- [ ] `.planning/phases/05-tournament-mode-replaces-old-comparison-mode-framing/05-HUMAN-UAT.md` — qualitative sign-off per D-25
- [ ] Framework install: none — all deps already present.

---

## Manual-Only Verifications

| Behavior                                             | Requirement | Why Manual                | Test Instructions                       |
| ---------------------------------------------------- | ----------- | ------------------------- | --------------------------------------- |
| "Tournament feels faster than scrolling" qualitative | HUMAN-UAT   | Subjective / perceptual   | See `05-HUMAN-UAT.md` scenarios 1–11    |
| Full-res crossfade smoothness at 60fps               | TOUR-08     | GPU-bound perception      | Manual dogfood with large selection     |
| Peek panel legibility vs background                  | PEEK-01/02  | Visual contrast judgement | Manual review across light/dark renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
