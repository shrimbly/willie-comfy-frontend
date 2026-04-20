---
phase: 02
slug: asset-pipeline
status: ready
nyquist_compliant: false # E2E behavioural coverage for ASSET-07/08/10 deferred to Phase 3 filter gate
wave_0_complete: true # Wave-0 TDD scaffolding landed (Plan 01)
created: 2026-04-20
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Coverage Status

**Automated behavioural coverage (authoritative for Phase 2 exit):**

- ASSET-01 unit+integration: Plan 07 + Plan 08 (OSS-path asset-id bridge)
- ASSET-02 manual: Plan 11 checkpoint
- ASSET-03/04 unit: Plan 02 + Plan 04
- ASSET-05 unit: Plan 05 + Plan 07
- ASSET-06 component: Plan 10
- ASSET-07 unit+integration: Plan 08 (warm-cache + progressive), component: Plan 09
- ASSET-08 unit+integration: Plan 08 (cancel), component: Plan 09
- ASSET-09 manual: Plan 11 checkpoint (re-pack tween)
- ASSET-10 unit+integration: Plan 08 (computeQueueDelta empty-diff case)

**Deferred to Phase 3 (no E2E coverage in Phase 2):**

- E2E behavioural coverage for ASSET-07/08/10 requires the filter gate, which lands in Phase 3. `asset-pipeline.spec.ts` ships with three `test.skip` scaffolds referencing their target requirements and the Phase 3 prelude for each. Helpers (`processingPill`, `waitForSpritesCount`, `cancelButton`) are in place so Phase 3's rewrite is a spec-file-only change.

`nyquist_compliant: false` is intentional — it flips `true` in Phase 3 once the E2E scaffolds are unskipped and passing.

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

> Populated by Plan 12 (wave 5). One row per task; every task maps to an automated command, a documented manual verification, or a "skipped — Phase 3" note.

| Task ID     | Plan | Wave | Requirement               | Threat Ref     | Secure Behavior                                          | Test Type   | Automated Command                                                                                                    | File Exists | Status  |
| ----------- | ---- | ---- | ------------------------- | -------------- | -------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- | ----------- | ------- |
| T-02-01-01  | 01   | 0    | ASSET-03                  | T-02-01-01     | Install idb + fake-indexeddb with vitest setup           | unit        | `pnpm install && node -e "require('idb')"`                                                                           | ✓           | pending |
| T-02-01-02  | 01   | 0    | ASSET-03,ASSET-07         | T-02-01-02     | Create 5 Wave-0 RED test files                           | unit        | `pnpm test:unit --run src/platform/moshpit`                                                                          | ✓           | pending |
| T-02-02-01  | 02   | 1    | ASSET-03                  | T-02-02-01     | contentHash pure utilities                               | unit        | `pnpm test:unit --run src/platform/moshpit/services/contentHash.test.ts`                                             | ✓           | pending |
| T-02-03-01  | 03   | 1    | ASSET-09                  | T-02-03-01     | layoutMath jittered/packed grid                          | unit        | `pnpm test:unit --run src/platform/moshpit/services/layoutMath.test.ts`                                              | ✓           | pending |
| T-02-04-01  | 04   | 1    | ASSET-03,ASSET-04         | T-02-04-01     | thumbRepository IDB CRUD                                 | unit        | `pnpm test:unit --run src/platform/moshpit/services/thumbRepository.test.ts`                                         | ✓           | pending |
| T-02-05-01  | 05   | 2    | ASSET-02                  | T-02-05-02     | Shared worker message contract                           | unit        | `pnpm typecheck`                                                                                                     | ✓           | pending |
| T-02-05-02  | 05   | 2    | ASSET-02,ASSET-05,ASSET-07| T-02-05-01..03 | thumbWorker processAsset handler                         | unit        | `pnpm test:unit --run src/platform/moshpit/services/thumbWorker.test.ts`                                             | ✓           | pending |
| T-02-06-01  | 06   | 2    | ASSET-03,ASSET-07,ASSET-08| T-02-06-01..04 | workerBridge routing + IDB write                         | unit        | `pnpm test:unit --run src/platform/moshpit/services/workerBridge.test.ts`                                            | ✓           | pending |
| T-02-07-01  | 07   | 3    | ASSET-01,ASSET-03,ASSET-04,ASSET-05,ASSET-06 | T-02-07-01..04 | 3 Pinia stores (thumb/metadata/curation) + OSS-path asset-id bridge | unit | `pnpm test:unit --run src/platform/moshpit/stores`                                             | ✓           | pending |
| T-02-08-01  | 08   | 3    | ASSET-01,ASSET-10         | T-02-08-01..05 | useMoshpitProcessingQueue diff + OSS-path bridge integration | unit   | `pnpm test:unit --run src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts`                            | ✓           | pending |
| T-02-09-01  | 09   | 4    | ASSET-07,ASSET-08         | T-02-09-01..03 | i18n keys + pill component + layout wire (queue owner)   | component   | `pnpm test:unit --run src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts`                            | ✓           | pending |
| T-02-10-01  | 10   | 4    | ASSET-05,ASSET-06         | T-02-10-01..02 | Excluded-count row + tooltip                             | component   | `pnpm test:unit --run src/platform/moshpit/components/MoshpitSettingsPanel.test.ts`                                  | ✓           | pending |
| T-02-11-01  | 11   | 4    | ASSET-02,ASSET-07,ASSET-09| T-02-11-01..05 | Sprite layer + injected queue + watchEffect + re-pack tween | manual   | Plan 11 human checkpoint                                                                                             | ✓           | pending |
| T-02-12-01  | 12   | 5    | ASSET-07,ASSET-08,ASSET-10| T-02-12-01..02 | E2E scaffolds (skipped — Phase 3 filter gate closes the loop) | e2e  | `pnpm test:browser:local -- --grep @moshpit` (3 tests skipped, shell tests pass)                                    | ✓           | pending |

---

## Wave 0 Requirements

- [x] `src/platform/moshpit/services/contentHash.test.ts` — unit stubs for SHA-256 utility
- [x] `src/platform/moshpit/services/thumbRepository.test.ts` — IDB repository (fake-indexeddb)
- [x] `src/platform/moshpit/services/layoutMath.test.ts` — jittered-grid cell assignment + seed hash determinism
- [x] `src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts` — filter-change queue diff, cancel behavior
- [x] `src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts` — pill render + cancel emit
- [x] `browser_tests/tests/moshpit/asset-pipeline.spec.ts` — cold-cache progressive render, warm-cache one-frame, cancel-and-resume (all skipped — Phase 3 filter gate)
- [x] `fake-indexeddb` dev dep (if not already present) — required for IDB repository tests in happy-dom

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter — **deferred to Phase 3** (E2E gate for ASSET-07/08/10 requires filter gate)

**Approval:** pending — awaiting unit + integration + manual sign-offs (Plan 11 + Plan 12 human checkpoints)
