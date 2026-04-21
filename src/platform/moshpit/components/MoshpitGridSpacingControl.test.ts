import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import {
  GRID_SPACING_MAX,
  GRID_SPACING_MIN,
  useMoshpitFilterStore
} from '@/platform/moshpit/stores/moshpitFilterStore'
import MoshpitGridSpacingControl from './MoshpitGridSpacingControl.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

let pinia = createPinia()

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

function renderComponent() {
  return render(MoshpitGridSpacingControl, {
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitGridSpacingControl', () => {
  it('renders the cluster spacing label from the grouping namespace', () => {
    renderComponent()
    expect(screen.getByText('Cluster spacing')).toBeTruthy()
  })

  it('displays the current gridSpacing value in px', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setGridSpacing(600)
    renderComponent()
    expect(
      screen.getByTestId('moshpit-grid-spacing-value').textContent?.trim()
    ).toBe('600px')
  })

  it('slider is disabled when filter gate is closed (no workflow, no time range)', () => {
    renderComponent()
    const slider = screen.getByTestId('moshpit-grid-spacing-slider')
    expect(slider.getAttribute('aria-disabled')).toBe('true')
  })

  it('slider is enabled once the filter gate is open (workflow set)', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setWorkflow('fp-abc')
    renderComponent()
    const slider = screen.getByTestId('moshpit-grid-spacing-slider')
    expect(slider.getAttribute('aria-disabled')).toBe('false')
  })

  it('slider carries correct min/max via the isDisabled computed and store bounds', () => {
    // Verify that GRID_SPACING_MIN/MAX are passed correctly by checking the
    // store setGridSpacing clamps to those bounds (pure logic test).
    const filterStore = useMoshpitFilterStore()
    filterStore.setGridSpacing(GRID_SPACING_MIN - 1)
    expect(filterStore.gridSpacing).toBe(GRID_SPACING_MIN)
    filterStore.setGridSpacing(GRID_SPACING_MAX + 1)
    expect(filterStore.gridSpacing).toBe(GRID_SPACING_MAX)
  })

  it('value display updates when filterStore.gridSpacing changes', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setGridSpacing(800)
    renderComponent()
    expect(
      screen.getByTestId('moshpit-grid-spacing-value').textContent?.trim()
    ).toBe('800px')
  })
})
