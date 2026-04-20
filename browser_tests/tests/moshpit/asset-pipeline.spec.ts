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
  test.skip(
    'cold cache shows processing pill and renders sprites progressively (ASSET-07) — deferred to Phase 3 filter gate',
    async ({ comfyPage }) => {
      const moshpit = new MoshpitCanvasHelper(comfyPage.page)
      // Phase 3 prelude (left here so the future author sees the shape):
      //   1. Clear IDB: indexedDB.deleteDatabase('moshpit-v1')
      //   2. moshpit.goto()
      //   3. moshpit.applyFilter({ workflow: 'any', timeRange: 'week' })
      //   4. expect(moshpit.processingPill()).toBeVisible()
      //   5. moshpit.waitForSpritesCount(1)
      await moshpit.goto()
      await expect(moshpit.container()).toBeVisible()
    }
  )

  test.skip(
    'warm cache skips the pill (ASSET-10 / D-08) — deferred to Phase 3 filter gate',
    async ({ comfyPage }) => {
      const moshpit = new MoshpitCanvasHelper(comfyPage.page)
      // Phase 3 prelude:
      //   1. Pre-populate IDB with synthetic thumbs matching the filter set
      //   2. moshpit.goto()
      //   3. moshpit.applyFilter({ ... }) — diff is empty → no pill
      //   4. expect(moshpit.processingPill()).toBeHidden()
      await moshpit.goto()
      await expect(moshpit.processingPill()).toBeHidden()
    }
  )

  test.skip(
    'cancel button aborts processing and the pill disappears (ASSET-08) — deferred to Phase 3 filter gate',
    async ({ comfyPage }) => {
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
    }
  )
})
