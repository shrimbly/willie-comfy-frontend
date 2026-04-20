---
phase: 02
slug: asset-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                          |
| ---------------------- | -------------------------------------------------------------- |
| **Framework**          | vitest 4.x (unit/component, happy-dom) + Playwright 1.58 (E2E) |
| **Config file**        | `vite.config.mts` (unit), `playwright.config.ts` (E2E)         |
| **Quick run command**  | `pnpm test:unit --run src/platform/moshpit`                    |
| **Full suite command** | `pnpm test:unit && pnpm typecheck && pnpm lint`                |
| **Estimated runtime**  | ~90 seconds                                                    |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit --run <scoped path>`
- **After every plan wave:** Run `pnpm test:unit --run src/platform/moshpit && pnpm typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Populated by planner during plan generation. One row per task; every task must map to an automated command or a documented manual verification.

| Task ID          | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status     |
| ---------------- | ---- | ---- | ----------- | ---------- | --------------- | --------- | ----------------- | ----------- | ---------- |
| _TBD by planner_ | —    | —    | —           | —          | —               | —         | —                 | —           | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/platform/moshpit/services/contentHash.test.ts` — unit stubs for SHA-256 utility
- [ ] `src/platform/moshpit/services/thumbRepository.test.ts` — IDB repository (fake-indexeddb)
- [ ] `src/platform/moshpit/services/layoutMath.test.ts` — jittered-grid cell assignment + seed hash determinism
- [ ] `src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts` — filter-change queue diff, cancel behavior
- [ ] `src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts` — pill render + cancel emit
- [ ] `browser_tests/tests/moshpit/asset-pipeline.spec.ts` — cold-cache progressive render, warm-cache one-frame, cancel-and-resume
- [ ] `fake-indexeddb` dev dep (if not already present) — required for IDB repository tests in happy-dom

---

## Manual-Only Verifications

| Behavior                                          | Requirement | Why Manual                                                                                                     | Test Instructions                                                                                                                  |
| ------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Jittered-grid chaos visual fidelity               | ASSET-03    | Aesthetic — dense but not overlapping, filter-hash reproducibility is subjective to visual pattern recognition | Enter Moshpit with a filter producing ~50 assets, screenshot the layout, reload with same filter, confirm same spatial arrangement |
| Indicator pill placement + fade-out polish        | ASSET-06    | 600ms hold + 200ms fade polish is hard to assert via automated timing                                          | Trigger cold-cache processing, visually confirm pill is bottom-left overlay, confirm fade-out on completion is smooth              |
| Re-pack tween easing quality                      | ASSET-07    | Subjective — 300ms ease-out-cubic should feel natural                                                          | Trigger a filter where >20% of assets are metadata-excluded; visually confirm re-pack animation is smooth and holes close          |
| 60fps pan/zoom during cold-cache processing at 5k | ASSET-10    | Requires real GPU + 5k dataset; Playwright perf traces are unreliable for sustained framerate                  | Load 5k-asset fixture, start processing, pan/zoom while worker runs, observe devtools Performance panel for frame drops            |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
