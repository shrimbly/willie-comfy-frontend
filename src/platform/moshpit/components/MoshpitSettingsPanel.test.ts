import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MoshpitSettingsPanel from './MoshpitSettingsPanel.vue'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      moshpit: {
        sidebar: { settings: 'Settings' },
        assets: {
          excludedCount:
            '{count} asset excluded: no metadata | {count} assets excluded: no metadata',
          excludedTooltip: 'Tooltip body',
          excludedTooltipLabel: 'Why?'
        }
      }
    }
  }
})

function mountPanel() {
  return render(MoshpitSettingsPanel, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      directives: {
        tooltip: { mounted: () => {} }
      }
    }
  })
}

describe('MoshpitSettingsPanel excluded-count row', () => {
  beforeEach(() => {
    // Reset pinia between tests is handled by createTestingPinia
  })

  it('hides the row when excludedCount === 0', () => {
    mountPanel()
    expect(screen.queryByTestId('moshpit-excluded-count')).toBeNull()
  })

  it('shows singular copy when excludedCount === 1', async () => {
    mountPanel()
    const store = useMoshpitMetadataStore()
    store.excludedCount = 1
    await new Promise((r) => setTimeout(r, 0))
    expect(
      screen.getByText('1 asset excluded: no metadata')
    ).toBeInTheDocument()
  })

  it('shows plural copy when excludedCount === 3', async () => {
    mountPanel()
    const store = useMoshpitMetadataStore()
    store.excludedCount = 3
    await new Promise((r) => setTimeout(r, 0))
    expect(
      screen.getByText('3 assets excluded: no metadata')
    ).toBeInTheDocument()
  })

  it('info icon exposes aria-label and aria-describedby', async () => {
    mountPanel()
    const store = useMoshpitMetadataStore()
    store.excludedCount = 2
    await new Promise((r) => setTimeout(r, 0))
    const icon = screen.getByRole('img', { name: /why\?/i })
    expect(icon).toHaveAttribute('aria-describedby')
  })
})
