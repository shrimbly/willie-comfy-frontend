import type { Page } from '@playwright/test'

export class MoshpitCanvasHelper {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/moshpit')
    await this.page.waitForSelector('#moshpit-canvas-container')
  }

  container() {
    return this.page.locator('#moshpit-canvas-container')
  }

  sideRail() {
    return this.page.getByTestId('moshpit-side-rail')
  }

  settingsTab() {
    return this.page.getByTestId('moshpit-settings-tab')
  }

  settingsPanel() {
    return this.page.getByTestId('moshpit-settings-panel')
  }

  marquee() {
    return this.page.getByTestId('moshpit-marquee')
  }

  async clickCanvas() {
    const box = await this.container().boundingBox()
    if (!box) throw new Error('moshpit canvas container not visible')
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  }
}
