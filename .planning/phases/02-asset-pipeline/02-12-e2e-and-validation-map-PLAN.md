---
phase: 02-asset-pipeline
plan: 12
type: execute
wave: 5
depends_on: ['02-09', '02-10', '02-11']
files_modified:
  - browser_tests/tests/moshpit/asset-pipeline.spec.ts
  - browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts
  - .planning/phases/02-asset-pipeline/02-VALIDATION.md
autonomous: false
requirements: [ASSET-07, ASSET-08, ASSET-10]
tags: [e2e, playwright, validation-map, wave-5]
must_haves:
  truths:
    - '`browser_tests/tests/moshpit/asset-pipeline.spec.ts` exists under the `@moshpit` tag and covers three scenarios (warm-cache, cold-cache, cancel-and-resume) — each test is `test.skip(...)` pending the Phase 3 filter gate. The skip messages cite Phase 3 and the requirement IDs. This prevents the VALIDATION map from giving false positive E2E coverage for ASSET-07/08/10 in Phase 2.'
    - "The existing `MoshpitCanvasHelper` is extended with `processingPill()`, `excludedCountRow()`, `cancelButton()`, and `waitForSpritesCount(n)` locator helpers — these ship NOW so Phase 3's test rewrite only touches the spec file"
    - 'Per-Task Verification Map table in `02-VALIDATION.md` is populated — every task in Plans 01..12 has a row with Task ID, Plan, Wave, Requirement, Secure Behavior (from threat model), Test Type, Automated Command, File Exists, Status'
    - 'VALIDATION.md frontmatter `wave_0_complete: true` is flipped (Wave-0 TDD scaffolding did land). `nyquist_compliant` remains **false** with a documented deferral note: `asset-pipeline.spec.ts` behavioural tests are skipped pending Phase 3 filter gate; automated-only paths still cover behaviour at unit/integration layers for ASSET-07/08/10'
    - 'Human checkpoint confirms the unit + integration suites pass and that the E2E scaffolds are skipped (not failing)'
  artifacts:
    - path: 'browser_tests/tests/moshpit/asset-pipeline.spec.ts'
      provides: 'Three @moshpit E2E scaffolds — skipped with Phase 3 deferral markers'
      contains: "test.describe('Moshpit asset pipeline'"
    - path: 'browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts'
      provides: 'Extended helpers for pill + excluded row + sprite wait (shipped early so Phase 3 only touches the spec)'
      contains: "processingPill\\(\\)|excludedCountRow\\(\\)"
    - path: '.planning/phases/02-asset-pipeline/02-VALIDATION.md'
      provides: 'Fully populated Per-Task Verification Map with honest nyquist_compliant=false + deferral'
      contains: 'wave_0_complete: true'
  key_links:
    - from: 'browser_tests/tests/moshpit/asset-pipeline.spec.ts'
      to: 'browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts'
      via: 'helper instantiation'
      pattern: 'MoshpitCanvasHelper'
---

<objective>
Close out Phase 2 with an honest validation map. Three scaffold scenarios in Playwright (warm, cold, cancel-resume) — ALL skipped pending Phase 3's filter gate, because Phase 2 has no way to trigger `queue.setFilter()` from a browser session. Extend the MoshpitCanvasHelper so Phase 3's rewrite only touches the spec file. Populate VALIDATION.md's Per-Task Verification Map so `/gsd-verify-work` has a single source of truth.

**Revision note (iter 1):** The original plan marked three behavioural E2E tests as passing and flipped `nyquist_compliant: true`. That was misleading — the tests did not exercise ASSET-07/08/10 because the filter gate doesn't exist in Phase 2. The revision: mark all three as `test.skip(...)` with a Phase 3 deferral comment; keep `nyquist_compliant: false` with a documented note that Phase 3 closes the gap. Unit + integration coverage at the Plan 08 / 11 layers IS authoritative for Phase 2 — this plan acknowledges that split cleanly.

Purpose: ASSET-07/08/10 proven at the unit+integration layer (Plans 08, 09, 11). VALIDATION.md is honest about what Phase 2 closes and what Phase 3 still owes. Scaffolds are in place so the Phase 3 filter-gate rewrite is trivial.

Output: One new E2E spec (~150 lines, all skipped), helper extension (~50 lines), VALIDATION.md table populated honestly, human checkpoint to confirm the suite is green (skipped ≠ failing).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-asset-pipeline/02-VALIDATION.md
@.planning/phases/02-asset-pipeline/02-CONTEXT.md
@browser_tests/tests/moshpit/moshpit-shell.spec.ts
@browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend MoshpitCanvasHelper + ship asset-pipeline.spec.ts as deferred scaffolds + honest VALIDATION.md</name>
  <read_first>
    - browser_tests/tests/moshpit/moshpit-shell.spec.ts (test shape + `comfyPageFixture as test` pattern)
    - browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts (extend — do not duplicate)
    - .claude/skills/writing-playwright-tests/SKILL.md (project test conventions)
    - docs/guidance/playwright.md (auto-retrying assertions; no waitForTimeout)
    - .planning/phases/02-asset-pipeline/02-UI-SPEC.md (data-testids: `moshpit-processing-indicator`, `moshpit-excluded-count`)
  </read_first>
  <action>
**1. Extend `browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts`:**

Preserve the existing methods; add these Locator helpers (they ship NOW so Phase 3's test rewrite doesn't need to touch this file):

```typescript
// ... existing imports + class definition ...

processingPill(): Locator {
  return this.page.getByTestId('moshpit-processing-indicator')
}

excludedCountRow(): Locator {
  return this.page.getByTestId('moshpit-excluded-count')
}

cancelButton(): Locator {
  return this.processingPill().getByRole('button', { name: /cancel processing/i })
}

async waitForSpritesCount(n: number, timeoutMs = 10_000): Promise<void> {
  // Asserts that the pill's aria-label reports done === n. Phase 3's filter-
  // gate tests will drive this via real filter application; Phase 2 ships it
  // for future consumption only.
  await this.page.waitForFunction(
    (expected) => {
      const pill = document.querySelector('[data-testid="moshpit-processing-indicator"]')
      if (!pill) return false
      const label = pill.getAttribute('aria-label') ?? ''
      const match = label.match(/(\d+)\s*\/\s*(\d+)/)
      if (!match) return false
      return parseInt(match[1], 10) >= expected
    },
    n,
    { timeout: timeoutMs }
  )
}
```

**2. Create `browser_tests/tests/moshpit/asset-pipeline.spec.ts` — three scenarios, ALL `test.skip`:**

```typescript
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { MoshpitCanvasHelper } from '@e2e/fixtures/helpers/MoshpitCanvasHelper'

/**
 * Phase 2 scaffold. All three scenarios are intentionally skipped: Phase 2
 * ships the asset pipeline plumbing, the UI shell, and the pill, but the
 * filter gate that actually triggers `queue.setFilter(...)` lives in Phase 3.
 * Without it, landing on /moshpit leaves the queue idle (PRD §5.5) and
 * nothing to assert at the E2E layer.
 *
 * Behavioural coverage for ASSET-07/08/10 in Phase 2 is at the unit +
 * integration layer (Plans 08, 09, 11). When Phase 3 lands its filter gate,
 * replace each `test.skip` with `test(...)` and add the filter-application
 * step (cited inline per scenario). The helpers (`processingPill`,
 * `waitForSpritesCount`, `cancelButton`) are already in place.
 */
test.describe('Moshpit asset pipeline', { tag: '@moshpit' }, () => {
  test.skip('cold cache shows processing pill and renders sprites progressively (ASSET-07) — deferred to Phase 3 filter gate', async ({
    comfyPage
  }) => {
    const moshpit = new MoshpitCanvasHelper(comfyPage.page)
    // Phase 3 prelude (left here so the future author sees the shape):
    //   1. Clear IDB: indexedDB.deleteDatabase('moshpit-v1')
    //   2. moshpit.goto()
    //   3. moshpit.applyFilter({ workflow: 'any', timeRange: 'week' })
    //   4. expect(moshpit.processingPill()).toBeVisible()
    //   5. moshpit.waitForSpritesCount(1)
    await moshpit.goto()
    await expect(moshpit.container()).toBeVisible()
  })

  test.skip('warm cache skips the pill (ASSET-10 / D-08) — deferred to Phase 3 filter gate', async ({
    comfyPage
  }) => {
    const moshpit = new MoshpitCanvasHelper(comfyPage.page)
    // Phase 3 prelude:
    //   1. Pre-populate IDB with synthetic thumbs matching the filter set
    //   2. moshpit.goto()
    //   3. moshpit.applyFilter({ ... }) — diff is empty → no pill
    //   4. expect(moshpit.processingPill()).toBeHidden()
    await moshpit.goto()
    await expect(moshpit.processingPill()).toBeHidden()
  })

  test.skip('cancel button aborts processing and the pill disappears (ASSET-08) — deferred to Phase 3 filter gate', async ({
    comfyPage
  }) => {
    const moshpit = new MoshpitCanvasHelper(comfyPage.page)
    // Phase 3 prelude:
    //   1. moshpit.goto()
    //   2. moshpit.applyFilter({ ... cold set ... })
    //   3. expect(moshpit.processingPill()).toBeVisible()
    //   4. moshpit.cancelButton().click()
    //   5. expect(moshpit.processingPill()).toBeHidden()
    //   6. Reload → pill reappears for remaining (D-07 auto-resume)
    await moshpit.goto()
    await expect(moshpit.container()).toBeVisible()
  })
})
```

Rationale for `test.skip` over direct-store-injection: a test-only `window.__moshpit_test` handle would require a Vite define gate + a `grep dist/` acceptance criterion to prove it's not in production builds. That's incremental surface area for a scaffold that Phase 3 rewrites anyway. Skipping is cheaper and more honest.

**3. Populate `.planning/phases/02-asset-pipeline/02-VALIDATION.md`:**

Open VALIDATION.md. Replace the placeholder row in the Per-Task Verification Map with one row per task across Plans 01..12. Use this template:

```
| T-02-{plan}-{task} | {plan} | {wave} | {req-ids} | T-02-{plan}-NN | {short description} | unit|integration|e2e|manual | {exact command or "manual" or "skipped — Phase 3"} | ✓ | pending |
```

Example rows (the executor fills all of these; one per task):

```
| T-02-01-01 | 01 | 0 | ASSET-03 | T-02-01-01 | Install idb + fake-indexeddb with vitest setup | unit | pnpm install &amp;&amp; node -e "require('idb')" | ✓ | pending |
| T-02-01-02 | 01 | 0 | ASSET-03,ASSET-07 | T-02-01-02 | Create 5 Wave-0 RED test files | unit | pnpm test:unit --run src/platform/moshpit | ✓ | pending |
| T-02-02-01 | 02 | 1 | ASSET-03 | T-02-02-01 | contentHash pure utilities | unit | pnpm test:unit --run src/platform/moshpit/services/contentHash.test.ts | ✓ | pending |
| T-02-03-01 | 03 | 1 | ASSET-09 | T-02-03-01 | layoutMath jittered/packed grid | unit | pnpm test:unit --run src/platform/moshpit/services/layoutMath.test.ts | ✓ | pending |
| T-02-04-01 | 04 | 1 | ASSET-03,ASSET-04 | T-02-04-01 | thumbRepository IDB CRUD | unit | pnpm test:unit --run src/platform/moshpit/services/thumbRepository.test.ts | ✓ | pending |
| T-02-05-01 | 05 | 2 | ASSET-02 | T-02-05-02 | Shared worker message contract | unit | pnpm typecheck | ✓ | pending |
| T-02-05-02 | 05 | 2 | ASSET-02,ASSET-05,ASSET-07 | T-02-05-01..03 | thumbWorker processAsset handler | unit | pnpm test:unit --run src/platform/moshpit/services/thumbWorker.test.ts | ✓ | pending |
| T-02-06-01 | 06 | 2 | ASSET-03,ASSET-07,ASSET-08 | T-02-06-01..04 | workerBridge routing + IDB write | unit | pnpm test:unit --run src/platform/moshpit/services/workerBridge.test.ts | ✓ | pending |
| T-02-07-01 | 07 | 3 | ASSET-01,ASSET-03,ASSET-04,ASSET-05,ASSET-06 | T-02-07-01..04 | 3 Pinia stores (thumb/metadata/curation) + OSS-path asset-id bridge | unit | pnpm test:unit --run src/platform/moshpit/stores | ✓ | pending |
| T-02-08-01 | 08 | 3 | ASSET-01,ASSET-10 | T-02-08-01..05 | useMoshpitProcessingQueue diff + OSS-path bridge integration | unit | pnpm test:unit --run src/platform/moshpit/composables/useMoshpitProcessingQueue.test.ts | ✓ | pending |
| T-02-09-01 | 09 | 4 | ASSET-07,ASSET-08 | T-02-09-01..03 | i18n keys + pill component + layout wire (queue owner) | component | pnpm test:unit --run src/platform/moshpit/components/MoshpitProcessingIndicator.test.ts | ✓ | pending |
| T-02-10-01 | 10 | 4 | ASSET-05,ASSET-06 | T-02-10-01..02 | Excluded-count row + tooltip | component | pnpm test:unit --run src/platform/moshpit/components/MoshpitSettingsPanel.test.ts | ✓ | pending |
| T-02-11-01 | 11 | 4 | ASSET-02,ASSET-07,ASSET-09 | T-02-11-01..05 | Sprite layer + injected queue + watchEffect + re-pack tween | manual | Plan 11 human checkpoint | ✓ | pending |
| T-02-12-01 | 12 | 5 | ASSET-07,ASSET-08,ASSET-10 | T-02-12-01..02 | E2E scaffolds (skipped — Phase 3 filter gate closes the loop) | e2e | pnpm test:browser:local -- --grep @moshpit (3 tests skipped, shell tests pass) | ✓ | pending |
```

Update frontmatter:

```yaml
---
phase: 02
slug: asset-pipeline
status: ready
nyquist_compliant: false # E2E behavioural coverage for ASSET-07/08/10 deferred to Phase 3 filter gate
wave_0_complete: true # Wave-0 TDD scaffolding landed (Plan 01)
created: 2026-04-20
---
```

Add a top-level note section in VALIDATION.md (after the frontmatter, before the existing tables):

```markdown
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
```

And at the bottom flip the Approval section:

```
**Approval:** pending — awaiting unit + integration + manual sign-offs (Plan 11 + Plan 12 human checkpoints)
```

Do NOT strip or rewrite the existing Manual-Only Verifications table or the Wave 0 Requirements checklist — those are preserved as-is.

Constraints:

- Every task must map to EITHER an automated command OR a Manual-Only reference OR a "skipped — Phase 3" note (for T-02-12-01 only).
- `pnpm test:browser:local` for the @moshpit tag MUST pass — the three new specs are skipped, not failing. Playwright reports `test.skip` as passing in the test-run summary.
  </action>
  <verify>
  <automated>node -e "const fs=require('fs');const md=fs.readFileSync('.planning/phases/02-asset-pipeline/02-VALIDATION.md','utf8');if(!md.includes('T-02-01-01')||!md.includes('T-02-12-01')||!md.match(/nyquist_compliant:\s*false/)||!md.match(/wave_0_complete:\s*true/))process.exit(1);console.log('ok')"</automated>
  </verify>
  <acceptance_criteria> - `test -f browser_tests/tests/moshpit/asset-pipeline.spec.ts` exits 0 - `grep "@moshpit" browser_tests/tests/moshpit/asset-pipeline.spec.ts` returns a match - `grep "comfyPageFixture as test" browser_tests/tests/moshpit/asset-pipeline.spec.ts` returns a match - `grep "test.skip" browser_tests/tests/moshpit/asset-pipeline.spec.ts` returns at least 3 matches (one per scenario) - `grep "deferred to Phase 3\\|Phase 3 filter gate" browser_tests/tests/moshpit/asset-pipeline.spec.ts` returns at least 3 matches (one deferral note per skipped test) - `grep "processingPill\\(\\)\\|excludedCountRow\\(\\)\\|cancelButton\\(\\)\\|waitForSpritesCount" browser_tests/fixtures/helpers/MoshpitCanvasHelper.ts` returns at least 4 matches - `grep "nyquist_compliant: false" .planning/phases/02-asset-pipeline/02-VALIDATION.md` returns a match (HONEST — Phase 3 closes the gap) - `grep "wave_0_complete: true" .planning/phases/02-asset-pipeline/02-VALIDATION.md` returns a match - `grep "Deferred to Phase 3\\|deferred to Phase 3" .planning/phases/02-asset-pipeline/02-VALIDATION.md` returns at least one match - `grep "T-02-01-01" .planning/phases/02-asset-pipeline/02-VALIDATION.md` returns at least one match - `grep "T-02-12-01" .planning/phases/02-asset-pipeline/02-VALIDATION.md` returns at least one match - `grep -c "^| T-02-" .planning/phases/02-asset-pipeline/02-VALIDATION.md` returns at least 14 (one row per task) - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>E2E spec shell shipped with HONEST deferral markers; helper extended; VALIDATION.md map populated with honest `nyquist_compliant: false` + Phase 3 deferral note.</done>
  </task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Human verification — run @moshpit suite against live backend; confirm skips vs fails</name>
  <what-built>
    - `browser_tests/tests/moshpit/asset-pipeline.spec.ts` (three scenarios, ALL `test.skip` with Phase 3 deferral markers)
    - Extended MoshpitCanvasHelper (helpers ready for Phase 3 rewrite)
    - Completed VALIDATION.md Per-Task Verification Map with honest `nyquist_compliant: false`
  </what-built>
  <how-to-verify>
    1. Start backend: `conda activate comfyui &amp;&amp; cd /Users/willie/Documents/projects/comfy/ComfyUI &amp;&amp; python main.py`
    2. Run: `pnpm test:browser:local -- --grep @moshpit`
    3. Expect: the 5 Phase-1 shell tests PASS; the 3 new asset-pipeline tests are reported as SKIPPED (NOT failing). Suite overall = pass.
    4. Confirm the Playwright summary shows `skipped: 3` (not `failed: 3`)
    5. Inspect VALIDATION.md — confirm `nyquist_compliant: false` with the Phase 3 deferral block visible
  </how-to-verify>
  <resume-signal>
    Reply "approved" if:
    - [ ] All 5 Phase-1 @moshpit shell tests pass
    - [ ] All 3 new asset-pipeline tests are SKIPPED (not failing)
    - [ ] VALIDATION.md `nyquist_compliant: false` + Phase 3 deferral note are present
    Otherwise, describe the failure mode.
  </resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                         | Description                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Playwright `page.evaluate` → IDB | Test-only writes to `moshpit-v1` DB; scoped to the isolated test origin (unused in Phase 2 — scaffolds skipped) |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                     | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                   |
| ---------- | ---------------------- | --------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-02-12-01 | Tampering              | Test IDB writes leaking into subsequent tests | mitigate    | When Phase 3 unskips these tests, each test will start by `indexedDB.deleteDatabase('moshpit-v1')`. Playwright test isolation gives each test its own browser context. No test-only API surface is shipped in Phase 2 that could leak into production (the direct-injection path was rejected in favour of skip). |
| T-02-12-02 | Information Disclosure | Coverage-map overstatement misleading checker | mitigate    | `nyquist_compliant: false` is intentionally preserved and the Deferred to Phase 3 block calls out the gap explicitly. The coverage map is honest about what Phase 2 unit/integration closes vs what Phase 3 E2E owes.                                                                                             |

</threat_model>

<verification>
- `pnpm test:browser:local -- --grep @moshpit` — shell tests PASS, asset-pipeline scaffolds SKIPPED (human checkpoint)
- `pnpm typecheck` exits 0
- `pnpm lint` on new E2E files exits 0
</verification>

<success_criteria>

- 3-scenario E2E scaffold lands with `test.skip` + Phase 3 deferral markers
- Helper extended without regressing Phase 1 shell tests
- VALIDATION.md Per-Task Verification Map populated for all 14+ tasks
- `nyquist_compliant: false` stays — honest about Phase 3 deferral
- `wave_0_complete: true` flips — Wave-0 TDD did land
  </success_criteria>

<output>
Create `.planning/phases/02-asset-pipeline/02-12-SUMMARY.md` documenting the final test count (unit + component + e2e-skipped), flipping the VALIDATION.md Approval line, and explicitly noting that `nyquist_compliant: true` is a Phase 3 deliverable.
</output>
