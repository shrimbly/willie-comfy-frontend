import type { Locator, Page } from '@playwright/test'

export class MoshpitCanvasHelper {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/moshpit')
    await this.page.waitForSelector('#moshpit-canvas-container')
  }

  container(): Locator {
    return this.page.locator('#moshpit-canvas-container')
  }

  sideRail(): Locator {
    return this.page.getByTestId('moshpit-side-rail')
  }

  settingsTab(): Locator {
    return this.page.getByTestId('moshpit-settings-tab')
  }

  settingsPanel(): Locator {
    return this.page.getByTestId('moshpit-settings-panel')
  }

  marquee(): Locator {
    return this.page.getByTestId('moshpit-marquee')
  }

  async clickCanvas() {
    const box = await this.container().boundingBox()
    if (!box) throw new Error('moshpit canvas container not visible')
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  }

  // Phase 2 helpers — shipped early so Phase 3's test rewrite only touches the
  // spec file. The processing indicator and excluded-count row are implemented
  // in Plans 09/10; these locators are ready for Phase 3 to unskip.

  processingPill(): Locator {
    return this.page.getByTestId('moshpit-processing-indicator')
  }

  excludedCountRow(): Locator {
    return this.page.getByTestId('moshpit-excluded-count')
  }

  cancelButton(): Locator {
    return this.processingPill().getByRole('button', {
      name: /cancel processing/i
    })
  }

  async waitForSpritesCount(n: number, timeoutMs = 10_000): Promise<void> {
    // Asserts that the pill's aria-label reports done >= n. Phase 3's filter-
    // gate tests will drive this via real filter application; Phase 2 ships it
    // for future consumption only.
    await this.page.waitForFunction(
      (expected) => {
        const pill = document.querySelector(
          '[data-testid="moshpit-processing-indicator"]'
        )
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
}
