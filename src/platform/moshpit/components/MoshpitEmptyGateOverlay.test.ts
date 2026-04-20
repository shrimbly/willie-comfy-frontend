import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import MoshpitEmptyGateOverlay from './MoshpitEmptyGateOverlay.vue'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      moshpit: {
        filters: {
          emptyStateHeading: 'Pick a workflow to start',
          emptyStateBody:
            'Select a workflow and time range in the Settings panel to populate the canvas.'
        }
      }
    }
  }
})

function mountOverlay() {
  return render(MoshpitEmptyGateOverlay, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n]
    }
  })
}

describe('MoshpitEmptyGateOverlay', () => {
  it('renders when filterStore.workflow is null (gate not open)', () => {
    mountOverlay()
    expect(screen.getByTestId('moshpit-empty-gate-overlay')).toBeInTheDocument()
  })

  it('does NOT render when filterStore.workflow is set', async () => {
    mountOverlay()
    const filterStore = useMoshpitFilterStore()
    filterStore.workflow = 'some-fingerprint'
    await new Promise((r) => setTimeout(r, 0))
    expect(
      screen.queryByTestId('moshpit-empty-gate-overlay')
    ).not.toBeInTheDocument()
  })

  it('contains the heading i18n string', () => {
    mountOverlay()
    expect(screen.getByText('Pick a workflow to start')).toBeInTheDocument()
  })

  it('contains the body i18n string', () => {
    mountOverlay()
    expect(
      screen.getByText(
        'Select a workflow and time range in the Settings panel to populate the canvas.'
      )
    ).toBeInTheDocument()
  })

  it('has pointer-events-none class on the container', () => {
    mountOverlay()
    const overlay = screen.getByTestId('moshpit-empty-gate-overlay')
    expect(overlay.classList.contains('pointer-events-none')).toBe(true)
  })
})
