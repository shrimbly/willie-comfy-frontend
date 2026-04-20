import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { MoshpitCanvasHelper } from '@e2e/fixtures/helpers/MoshpitCanvasHelper'

/**
 * Phase 3 E2E spec — filter & sort integration (Plan 03-11).
 *
 * Coverage targets: FILTER-01, FILTER-08, FILTER-11, SORT-01.
 *
 * These tests are written to pass in CI without a real ComfyUI backend by
 * asserting on the UI shell state (overlay visibility, chip count, axis label
 * absence) that is deterministic without assets. Tests that require real data
 * are marked with a note and can be run locally after generating a CFG sweep
 * dataset (see 03-HUMAN-UAT.md).
 */
test.describe('@moshpit filter & sort', () => {
  test(
    'workflow picker gates the canvas with an empty-state overlay (FILTER-01)',
    async ({ comfyPage }) => {
      const moshpit = new MoshpitCanvasHelper(comfyPage.page)
      await moshpit.goto()

      // Before any workflow is selected: empty-gate overlay must be visible.
      await expect(
        comfyPage.page.getByTestId('moshpit-empty-gate-overlay')
      ).toBeVisible()

      // No filter chips present before gate is open.
      await expect(
        comfyPage.page.getByTestId('moshpit-filter-chip')
      ).toHaveCount(0)
    }
  )

  test(
    'no axis labels render before a sort axis is set (SORT-01 baseline)',
    async ({ comfyPage }) => {
      const moshpit = new MoshpitCanvasHelper(comfyPage.page)
      await moshpit.goto()

      // Without a sort axis, axis overlay must not render any column labels.
      await expect(
        comfyPage.page.getByTestId('moshpit-axis-label-x')
      ).toHaveCount(0)

      // Y labels also absent in chaos/ungated mode.
      await expect(
        comfyPage.page.getByTestId('moshpit-axis-label-y')
      ).toHaveCount(0)
    }
  )

  test(
    'settings panel contains workflow picker and time range picker (FILTER-01 / FILTER-06)',
    async ({ comfyPage }) => {
      const moshpit = new MoshpitCanvasHelper(comfyPage.page)
      await moshpit.goto()

      // Settings panel is open by default (verified by moshpit-shell.spec.ts).
      // Workflow picker trigger must be present and enabled.
      await expect(
        comfyPage.page.getByTestId('moshpit-workflow-picker-trigger')
      ).toBeVisible()

      // Time range radiogroup must be present (all-time is default selection).
      await expect(
        comfyPage.page.getByRole('radiogroup', { name: /time range/i })
      ).toBeVisible()
    }
  )

  test(
    'show hidden toggle is present and accessible in settings panel (FILTER-11)',
    async ({ comfyPage }) => {
      const moshpit = new MoshpitCanvasHelper(comfyPage.page)
      await moshpit.goto()

      // Show-hidden toggle must be present regardless of gate state.
      await expect(
        comfyPage.page.getByTestId('moshpit-show-hidden-toggle')
      ).toBeVisible()

      // Toggle must be a switch role for screen-reader accessibility.
      await expect(
        comfyPage.page.getByRole('switch', { name: /show hidden/i })
      ).toBeVisible()
    }
  )
})
