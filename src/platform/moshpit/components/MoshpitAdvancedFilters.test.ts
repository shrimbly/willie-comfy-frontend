import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import MoshpitAdvancedFilters from './MoshpitAdvancedFilters.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

// Stub the inner chip row — its tier-aware filtering is tested separately.
vi.mock('./MoshpitFilterChipRow.vue', () => ({
  default: {
    name: 'MoshpitFilterChipRow',
    props: ['tier'],
    template:
      '<div data-testid="moshpit-filter-chip-row" :data-tier="tier">chip-row-{{ tier }}</div>'
  }
}))

let pinia = createPinia()

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

function renderComponent() {
  return render(MoshpitAdvancedFilters, {
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitAdvancedFilters', () => {
  it('renders the trigger with the advanced filters label', () => {
    renderComponent()
    expect(
      screen.getByText(enMessages.moshpit.filters.advancedLabel)
    ).toBeTruthy()
    expect(
      screen.getByTestId('moshpit-advanced-filters-trigger')
    ).toBeInTheDocument()
  })

  it('starts closed when filterStore.isAdvancedOpen is false (default)', () => {
    renderComponent()
    // Reka Collapsible hides content when closed (content is either not in DOM
    // or hidden); the chip row stub should not be rendered.
    expect(
      screen.queryByTestId('moshpit-filter-chip-row')
    ).not.toBeInTheDocument()
  })

  it('renders the advanced chip row when filterStore.isAdvancedOpen is true', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setAdvancedOpen(true)
    renderComponent()
    const row = screen.getByTestId('moshpit-filter-chip-row')
    expect(row).toBeInTheDocument()
    expect(row.getAttribute('data-tier')).toBe('advanced')
  })

  it('clicking the trigger invokes filterStore.setAdvancedOpen with the new open state', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    const spy = vi.spyOn(filterStore, 'setAdvancedOpen')
    renderComponent()
    const trigger = screen.getByTestId('moshpit-advanced-filters-trigger')
    await user.click(trigger)
    expect(spy).toHaveBeenCalled()
    // Reka passes new boolean to @update:open
    expect(spy.mock.calls[0][0]).toBe(true)
  })

  it('chevron icon swaps between down and up based on open state', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setAdvancedOpen(true)
    renderComponent()
    const trigger = screen.getByTestId('moshpit-advanced-filters-trigger')
    expect(trigger.innerHTML).toContain('icon-[lucide--chevron-up]')
  })

  it('chevron defaults to down when closed', () => {
    renderComponent()
    const trigger = screen.getByTestId('moshpit-advanced-filters-trigger')
    expect(trigger.innerHTML).toContain('icon-[lucide--chevron-down]')
  })
})
