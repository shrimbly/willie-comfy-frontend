import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import MoshpitShowHiddenToggle from './MoshpitShowHiddenToggle.vue'

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
  return render(MoshpitShowHiddenToggle, {
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitShowHiddenToggle', () => {
  it('renders the show hidden label text', () => {
    renderComponent()
    expect(screen.getByText('Show hidden')).toBeTruthy()
  })

  it('toggle has role="switch"', () => {
    renderComponent()
    expect(screen.getByRole('switch')).toBeTruthy()
  })

  it('toggle has aria-checked="false" when showHidden is false', () => {
    renderComponent()
    const toggle = screen.getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('false')
  })

  it('toggle has aria-checked="true" when showHidden is true', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setShowHidden(true)
    renderComponent()
    const toggle = screen.getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  it('clicking the toggle sets showHidden to true when it was false', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    renderComponent()
    await user.click(screen.getByRole('switch'))
    expect(filterStore.showHidden).toBe(true)
  })

  it('clicking the toggle sets showHidden to false when it was true', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    filterStore.setShowHidden(true)
    renderComponent()
    await user.click(screen.getByRole('switch'))
    expect(filterStore.showHidden).toBe(false)
  })

  it('label element is associated with the toggle via wrapping', () => {
    renderComponent()
    expect(screen.getByTestId('moshpit-show-hidden-label').tagName.toLowerCase()).toBe('label')
    expect(screen.getByTestId('moshpit-show-hidden-toggle')).toBeTruthy()
  })
})
