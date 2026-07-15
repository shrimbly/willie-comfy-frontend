import { describe, expect, it } from 'vitest'

import { shouldShowModelDownloadSidebarIndicator } from './modelDownloadUiStore'

describe('shouldShowModelDownloadSidebarIndicator', () => {
  it('keeps a close control while Downloads is open in floating mode', () => {
    expect(
      shouldShowModelDownloadSidebarIndicator('floating', true, true)
    ).toBe(true)
  })

  it('falls back to the sidebar when the topbar is unavailable', () => {
    expect(
      shouldShowModelDownloadSidebarIndicator('topbar', false, false)
    ).toBe(true)
  })

  it('does not duplicate available floating or topbar indicators', () => {
    expect(
      shouldShowModelDownloadSidebarIndicator('floating', false, true)
    ).toBe(false)
    expect(shouldShowModelDownloadSidebarIndicator('topbar', false, true)).toBe(
      false
    )
  })
})
