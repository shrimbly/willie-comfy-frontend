import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import { GROUPING_AXES } from '@/platform/moshpit/services/groupAxes'
import MoshpitGroupingToggles from './MoshpitGroupingToggles.vue'

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
  return render(MoshpitGroupingToggles, {
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitGroupingToggles', () => {
  it('renders a role="group" container with the section aria-label', () => {
    renderComponent()
    const group = screen.getByRole('group', {
      name: enMessages.moshpit.grouping.sectionLabel
    })
    expect(group).toBeTruthy()
  })

  it('renders exactly 5 pill buttons in GROUPING_AXES order', () => {
    renderComponent()
    const pills = GROUPING_AXES.map((axis) =>
      screen.getByTestId(`moshpit-grouping-toggle-${axis}`)
    )
    expect(pills).toHaveLength(GROUPING_AXES.length)
    for (let i = 0; i < GROUPING_AXES.length; i += 1) {
      const axis = GROUPING_AXES[i]
      const label = enMessages.moshpit.grouping.axis[axis]
      expect(pills[i].textContent?.trim()).toBe(label)
    }
  })

  it('every pill starts with aria-pressed="false" when no groupings are active', () => {
    renderComponent()
    for (const axis of GROUPING_AXES) {
      const pill = screen.getByTestId(`moshpit-grouping-toggle-${axis}`)
      expect(pill.getAttribute('aria-pressed')).toBe('false')
    }
  })

  it('marks an active pill with aria-pressed="true" when filterStore.activeGroupings includes it', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.toggleGrouping('workflow')
    renderComponent()
    const pill = screen.getByTestId('moshpit-grouping-toggle-workflow')
    expect(pill.getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking an inactive pill adds the axis to activeGroupings and flips aria-pressed to "true"', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    renderComponent()
    const pill = screen.getByTestId('moshpit-grouping-toggle-prompt')
    expect(pill.getAttribute('aria-pressed')).toBe('false')

    await user.click(pill)
    expect(filterStore.activeGroupings).toContain('prompt')
    expect(pill.getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking an active pill removes the axis and flips aria-pressed to "false"', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    filterStore.toggleGrouping('model')
    renderComponent()
    const pill = screen.getByTestId('moshpit-grouping-toggle-model')
    expect(pill.getAttribute('aria-pressed')).toBe('true')

    await user.click(pill)
    expect(filterStore.activeGroupings).not.toContain('model')
    expect(pill.getAttribute('aria-pressed')).toBe('false')
  })

  it('keyboard Enter on a focused pill invokes the toggle', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    renderComponent()
    const pill = screen.getByTestId('moshpit-grouping-toggle-saveNode')
    pill.focus()
    await user.keyboard('{Enter}')
    expect(filterStore.activeGroupings).toContain('saveNode')
  })

  it('renders all 5 pills active when every axis is toggled on', () => {
    const filterStore = useMoshpitFilterStore()
    for (const axis of GROUPING_AXES) {
      filterStore.toggleGrouping(axis)
    }
    renderComponent()
    for (const axis of GROUPING_AXES) {
      const pill = screen.getByTestId(`moshpit-grouping-toggle-${axis}`)
      expect(pill.getAttribute('aria-pressed')).toBe('true')
    }
  })
})
