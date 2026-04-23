/**
 * Behavioural coverage of MoshpitFloatingActionBar — the bottom-center overlay
 * shown whenever selection has >=1 asset (and tournament mode is not active).
 * Integrates against the real useMoshpitSpriteActions composable so the test
 * covers the end-to-end shared-action wiring.
 */
import { createTestingPinia } from '@pinia/testing'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'
import { useAssetsStore } from '@/stores/assetsStore'

import MoshpitFloatingActionBar from './MoshpitFloatingActionBar.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      moshpit: {
        actionBar: {
          selectedCount: '{count} selected | {count} selected',
          unpin: 'Unpin',
          download: 'Download',
          clear: 'Clear'
        },
        contextMenu: {
          downloadStarted: 'Download started',
          downloadStartedMulti: 'Started download of {count} assets'
        }
      }
    }
  }
})

function renderBar() {
  render(MoshpitFloatingActionBar, {
    global: {
      plugins: [
        createTestingPinia({ stubActions: false, createSpy: vi.fn }),
        i18n
      ]
    }
  })
}

function makeAsset(id: string, hash: string): AssetItem {
  return {
    id,
    asset_hash: hash,
    name: `${id}.png`,
    size: 100,
    mime_type: 'image/png',
    tags: ['output'],
    created_at: '2024-01-01',
    last_access_time: '2024-01-01',
    user_metadata: {}
  } as unknown as AssetItem
}

describe('MoshpitFloatingActionBar — visibility', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('is not rendered when selection is empty', () => {
    renderBar()
    expect(screen.queryByTestId('moshpit-action-bar-count')).toBeNull()
  })

  it('renders with count when selection > 0', async () => {
    renderBar()
    const selection = useMoshpitSelectionStore()
    selection.setSelection(['a', 'b', 'c'])

    await waitFor(() => {
      expect(screen.getByTestId('moshpit-action-bar-count')).not.toBeNull()
    })
    expect(
      screen.queryByTestId('moshpit-action-bar-count')?.textContent
    ).toContain('3 selected')
  })

  it('is hidden while tournament mode is active', async () => {
    renderBar()
    const selection = useMoshpitSelectionStore()
    const tournament = useMoshpitTournamentStore()
    selection.setSelection(['a', 'b'])
    tournament.isActive = true

    await waitFor(() => {
      expect(screen.queryByTestId('moshpit-action-bar-count')).toBeNull()
    })
  })
})

describe('MoshpitFloatingActionBar — Unpin', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('is disabled when none of the selection is pinned', async () => {
    renderBar()
    const selection = useMoshpitSelectionStore()
    selection.setSelection(['a', 'b'])

    await waitFor(() => {
      expect(screen.getByTestId('moshpit-action-bar-unpin')).not.toBeNull()
    })
    expect(screen.queryByTestId('moshpit-action-bar-unpin')).toHaveProperty(
      'disabled',
      true
    )
  })

  it('is enabled and unpins when at least one hash is pinned', async () => {
    renderBar()
    const selection = useMoshpitSelectionStore()
    const overrides = useMoshpitOverrideStore()
    selection.setSelection(['a', 'b'])
    overrides.setPin('a', { x: 1, y: 2 })

    await waitFor(() => {
      const btn = screen.queryByTestId('moshpit-action-bar-unpin')
      expect(btn).not.toBeNull()
      expect(btn).toHaveProperty('disabled', false)
    })

    const btn = screen.queryByTestId('moshpit-action-bar-unpin')
    if (!btn) throw new Error('unpin button not found')
    await userEvent.click(btn)

    expect(overrides.isPinned('a')).toBe(false)
  })
})

describe('MoshpitFloatingActionBar — Clear', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('empties the selection and removes the bar from the DOM', async () => {
    renderBar()
    const selection = useMoshpitSelectionStore()
    selection.setSelection(['a', 'b', 'c'])

    await waitFor(() => {
      expect(screen.getByTestId('moshpit-action-bar-clear')).not.toBeNull()
    })

    const btn = screen.queryByTestId('moshpit-action-bar-clear')
    if (!btn) throw new Error('clear button not found')
    await userEvent.click(btn)

    expect(selection.size).toBe(0)
    await waitFor(() => {
      expect(screen.queryByTestId('moshpit-action-bar-count')).toBeNull()
    })
  })
})

describe('MoshpitFloatingActionBar — Download', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('triggers one anchor click per resolvable hash in selection', async () => {
    renderBar()
    const selection = useMoshpitSelectionStore()
    const assets = useAssetsStore()
    assets.historyAssets = [makeAsset('a', 'hash-A'), makeAsset('b', 'hash-B')]
    selection.setSelection(['hash-A', 'hash-B'])

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    await waitFor(() => {
      expect(screen.getByTestId('moshpit-action-bar-download')).not.toBeNull()
    })
    const btn = screen.queryByTestId('moshpit-action-bar-download')
    if (!btn) throw new Error('download button not found')
    await userEvent.click(btn)

    expect(clickSpy).toHaveBeenCalledTimes(2)
  })
})
