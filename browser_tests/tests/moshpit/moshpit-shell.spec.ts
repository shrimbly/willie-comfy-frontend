import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { MoshpitCanvasHelper } from '@e2e/fixtures/helpers/MoshpitCanvasHelper'

test.describe('Moshpit shell', { tag: '@moshpit' }, () => {
  test('navigates to /moshpit and shows full-bleed canvas container', async ({
    comfyPage
  }) => {
    const moshpit = new MoshpitCanvasHelper(comfyPage.page)
    await moshpit.goto()
    await expect(moshpit.container()).toBeVisible()
    await expect(moshpit.sideRail()).toBeVisible()
  })

  test('settings panel is open by default on entry', async ({ comfyPage }) => {
    const moshpit = new MoshpitCanvasHelper(comfyPage.page)
    await moshpit.goto()
    await expect(moshpit.settingsPanel()).toBeVisible()
  })

  test('first canvas click auto-collapses settings panel (D-11/D-12)', async ({
    comfyPage
  }) => {
    const moshpit = new MoshpitCanvasHelper(comfyPage.page)
    await moshpit.goto()
    await expect(moshpit.settingsPanel()).toBeVisible()
    await moshpit.clickCanvas()
    await expect(moshpit.settingsPanel()).toBeHidden()
  })

  test('re-opening via rail icon locks out future auto-collapse (D-11)', async ({
    comfyPage
  }) => {
    const moshpit = new MoshpitCanvasHelper(comfyPage.page)
    await moshpit.goto()
    await moshpit.clickCanvas()
    await expect(moshpit.settingsPanel()).toBeHidden()
    await moshpit.settingsTab().click()
    await expect(moshpit.settingsPanel()).toBeVisible()
    await moshpit.clickCanvas()
    // Still visible — auto-collapse is locked out after explicit re-open.
    await expect(moshpit.settingsPanel()).toBeVisible()
  })

  // SHELL-05: prove the workflow graph is unchanged across a /moshpit round-trip.
  // If keep-alive is misconfigured, graph._version increments via onAdded callbacks
  // and this test fails loudly.
  test('SHELL-05: workflow graph is preserved across /moshpit round-trip', async ({
    comfyPage
  }) => {
    await comfyPage.page.goto('/')
    await comfyPage.nextFrame()

    const nodeCountBefore = await comfyPage.page.evaluate(() => {
      // @ts-expect-error ComfyUI global
      return window.app?.graph?.nodes?.length ?? 0
    })
    const versionBefore = await comfyPage.page.evaluate(() => {
      // @ts-expect-error ComfyUI global
      return window.app?.graph?._version ?? 0
    })

    await comfyPage.page.goto('/moshpit')
    await expect(
      comfyPage.page.locator('#moshpit-canvas-container')
    ).toBeVisible()

    await comfyPage.page.goto('/')
    await comfyPage.nextFrame()

    const nodeCountAfter = await comfyPage.page.evaluate(() => {
      // @ts-expect-error ComfyUI global
      return window.app?.graph?.nodes?.length ?? 0
    })
    const versionAfter = await comfyPage.page.evaluate(() => {
      // @ts-expect-error ComfyUI global
      return window.app?.graph?._version ?? 0
    })

    expect(nodeCountAfter).toBe(nodeCountBefore)
    expect(versionAfter).toBe(versionBefore)
  })
})
