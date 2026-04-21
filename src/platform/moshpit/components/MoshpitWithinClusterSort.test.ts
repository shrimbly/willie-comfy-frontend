import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import MoshpitWithinClusterSort from './MoshpitWithinClusterSort.vue'

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
  return render(MoshpitWithinClusterSort, {
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitWithinClusterSort', () => {
  it('renders a label with the withinSort section label', () => {
    renderComponent()
    expect(
      screen.getByText(enMessages.moshpit.grouping.withinSort.label)
    ).toBeTruthy()
  })

  it('renders a select combobox with exactly 3 options', () => {
    renderComponent()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.options).toHaveLength(3)
    const values = Array.from(select.options).map((o) => o.value)
    expect(values).toEqual(['newestFirst', 'oldestFirst', 'alphabetical'])
  })

  it('each option renders the i18n-translated label', () => {
    renderComponent()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    const labels = Array.from(select.options).map((o) => o.textContent?.trim())
    expect(labels).toEqual([
      enMessages.moshpit.grouping.withinSort.newestFirst,
      enMessages.moshpit.grouping.withinSort.oldestFirst,
      enMessages.moshpit.grouping.withinSort.alphabetical
    ])
  })

  it('default selection matches filterStore.withinClusterSort ("newestFirst")', () => {
    renderComponent()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('newestFirst')
  })

  it('changing the select calls filterStore.setWithinClusterSort with the new mode', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    const spy = vi.spyOn(filterStore, 'setWithinClusterSort')
    renderComponent()
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'oldestFirst')
    expect(spy).toHaveBeenCalledWith('oldestFirst')
    expect(filterStore.withinClusterSort).toBe('oldestFirst')
  })

  it('label element is associated with the select via htmlFor/id', () => {
    renderComponent()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    const label = screen.getByText(enMessages.moshpit.grouping.withinSort.label)
    const labelFor = label.getAttribute('for')
    expect(labelFor).toBeTruthy()
    expect(labelFor).toBe(select.id)
  })
})
