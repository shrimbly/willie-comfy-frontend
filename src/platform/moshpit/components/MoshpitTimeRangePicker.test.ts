import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import MoshpitTimeRangePicker from './MoshpitTimeRangePicker.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function mountPicker() {
  return render(MoshpitTimeRangePicker, {
    global: { plugins: [createPinia(), i18n] }
  })
}

describe('MoshpitTimeRangePicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders 5 preset pills with accessible names matching i18n labels', () => {
    mountPicker()
    const f = enMessages.moshpit.filters
    expect(screen.getByRole('radio', { name: f.timeRangeToday })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: f.timeRangeThisWeek })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: f.timeRangeThisMonth })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: f.timeRangeAllTime })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: f.timeRangeCustom })).toBeInTheDocument()
  })

  it('default preset "all" has aria-checked="true"; others have aria-checked="false"', () => {
    mountPicker()
    const f = enMessages.moshpit.filters
    expect(screen.getByRole('radio', { name: f.timeRangeAllTime })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('radio', { name: f.timeRangeToday })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('clicking "Today" calls setTimeRange with { preset: "today", from: null, to: null }', async () => {
    const user = userEvent.setup()
    mountPicker()
    const filterStore = useMoshpitFilterStore()
    const f = enMessages.moshpit.filters

    await user.click(screen.getByRole('radio', { name: f.timeRangeToday }))

    expect(filterStore.timeRange).toEqual({ preset: 'today', from: null, to: null })
  })

  it('clicking "Custom…" reveals the From and To date inputs', async () => {
    const user = userEvent.setup()
    mountPicker()
    const f = enMessages.moshpit.filters

    // Before clicking Custom, date inputs should not exist
    expect(screen.queryByRole('textbox', { name: f.timeRangeFrom })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: f.timeRangeCustom }))

    // After selecting Custom, From and To inputs appear
    expect(screen.getByLabelText(f.timeRangeFrom)).toBeInTheDocument()
    expect(screen.getByLabelText(f.timeRangeTo)).toBeInTheDocument()
  })

  it('From/To inputs are NOT in the DOM when preset is not "custom"', () => {
    mountPicker()
    const f = enMessages.moshpit.filters
    // Default preset is 'all' — no date inputs
    expect(screen.queryByLabelText(f.timeRangeFrom)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(f.timeRangeTo)).not.toBeInTheDocument()
  })

  it('typing a valid date into From calls setTimeRange with the correct epoch', async () => {
    const user = userEvent.setup()
    mountPicker()
    const filterStore = useMoshpitFilterStore()
    const f = enMessages.moshpit.filters

    // Switch to custom to reveal inputs
    await user.click(screen.getByRole('radio', { name: f.timeRangeCustom }))
    const fromInput = screen.getByLabelText(f.timeRangeFrom)

    await user.type(fromInput, '2026-04-21')
    // Trigger the change event with the value directly
    fromInput.setAttribute('value', '2026-04-21')
    fromInput.dispatchEvent(new Event('change', { bubbles: true }))

    // Date.UTC(2026, 3, 21) = April 21, 2026 00:00:00Z
    expect(filterStore.timeRange.from).toBe(Date.UTC(2026, 3, 21))
    expect(filterStore.timeRange.preset).toBe('custom')
  })

  it('typing an invalid date string leaves from unchanged (null)', async () => {
    const user = userEvent.setup()
    mountPicker()
    const filterStore = useMoshpitFilterStore()
    const f = enMessages.moshpit.filters

    await user.click(screen.getByRole('radio', { name: f.timeRangeCustom }))
    const fromInput = screen.getByLabelText(f.timeRangeFrom)

    // Fire change event with empty / invalid value
    fromInput.setAttribute('value', '')
    fromInput.dispatchEvent(new Event('change', { bubbles: true }))

    // from should remain null (isoDateToEpoch('') → null)
    expect(filterStore.timeRange.from).toBeNull()
  })
})
