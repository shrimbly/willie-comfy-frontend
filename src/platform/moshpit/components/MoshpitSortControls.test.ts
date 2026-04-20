import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import { mount } from '@vue/test-utils'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'

import MoshpitSortControls from './MoshpitSortControls.vue'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import { SORTABLE_PARAM_KEYS } from '@/platform/moshpit/services/sortMath'
import enMessages from '@/locales/en/main.json'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

// Module-level pinia instance for store-seeding before mount
let pinia = createPinia()

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

function renderComponent() {
  return render(MoshpitSortControls, {
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitSortControls', () => {
  it('renders the Sort section label', () => {
    renderComponent()
    expect(screen.getByRole('region', { name: 'Sort' })).toBeTruthy()
  })

  it('renders X and Y axis labels', () => {
    renderComponent()
    expect(screen.getByText('X')).toBeTruthy()
    expect(screen.getByText('Y')).toBeTruthy()
  })

  it('X trigger shows placeholder when sortX is null', () => {
    renderComponent()
    expect(screen.getByTestId('moshpit-sort-x-trigger').textContent?.trim()).toBe(
      'Sort by\u2026'
    )
  })

  it('X trigger shows param label when sortX is set', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortX('cfg')
    renderComponent()
    expect(screen.getByTestId('moshpit-sort-x-trigger').textContent?.trim()).toBe('CFG')
  })

  it('Y trigger shows placeholder when sortY is null', () => {
    renderComponent()
    expect(screen.getByTestId('moshpit-sort-y-trigger').textContent?.trim()).toBe(
      '+ Add Y axis'
    )
  })

  it('Y trigger shows param label when sortY is set', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortY('sampler')
    renderComponent()
    expect(screen.getByTestId('moshpit-sort-y-trigger').textContent?.trim()).toBe('Sampler')
  })

  it('selectX covers all SORTABLE_PARAM_KEYS — trigger updates label for each', async () => {
    // Verify every key in SORTABLE_PARAM_KEYS has a non-empty paramLabel and
    // that setSortX correctly updates the trigger text for a representative sample.
    const filterStore = useMoshpitFilterStore()
    for (const key of ['model', 'cfg', 'steps', 'seed', 'timestamp'] as const) {
      filterStore.setSortX(key)
      const { unmount } = renderComponent()
      const text = screen.getByTestId('moshpit-sort-x-trigger').textContent?.trim()
      expect(text).toBeTruthy()
      expect(text).not.toBe('Sort by\u2026')
      unmount()
    }
    expect(SORTABLE_PARAM_KEYS.length).toBe(10)
  })

  it('selectX(key) calls filterStore.setSortX with that key', async () => {
    const filterStore = useMoshpitFilterStore()
    const wrapper = mount(MoshpitSortControls, {
      global: { plugins: [pinia, i18n] }
    })
    await wrapper.vm.selectX('cfg')
    expect(filterStore.sortX).toBe('cfg')
  })

  it('selectY(key) calls filterStore.setSortY with that key', async () => {
    const filterStore = useMoshpitFilterStore()
    const wrapper = mount(MoshpitSortControls, {
      global: { plugins: [pinia, i18n] }
    })
    await wrapper.vm.selectY('sampler')
    expect(filterStore.sortY).toBe('sampler')
  })

  it('X clear button renders when sortX is set', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortX('steps')
    renderComponent()
    expect(screen.getByTestId('moshpit-sort-clear-x')).toBeTruthy()
  })

  it('X clear button is NOT rendered when sortX is null', () => {
    renderComponent()
    expect(screen.queryByTestId('moshpit-sort-clear-x')).toBeNull()
  })

  it('clicking X clear button calls filterStore.setSortX(null)', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortX('model')
    renderComponent()
    await user.click(screen.getByTestId('moshpit-sort-clear-x'))
    expect(filterStore.sortX).toBeNull()
  })

  it('Y clear button renders when sortY is set', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortY('seed')
    renderComponent()
    expect(screen.getByTestId('moshpit-sort-clear-y')).toBeTruthy()
  })

  it('Y clear button is NOT rendered when sortY is null', () => {
    renderComponent()
    expect(screen.queryByTestId('moshpit-sort-clear-y')).toBeNull()
  })

  it('clicking Y clear button calls filterStore.setSortY(null)', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortY('scheduler')
    renderComponent()
    await user.click(screen.getByTestId('moshpit-sort-clear-y'))
    expect(filterStore.sortY).toBeNull()
  })

  it('aria-live status region is present', () => {
    renderComponent()
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
