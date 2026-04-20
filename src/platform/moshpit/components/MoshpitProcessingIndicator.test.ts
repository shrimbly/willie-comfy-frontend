import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import MoshpitProcessingIndicator from './MoshpitProcessingIndicator.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const mountPill = (props: { done: number; total: number }) =>
  render(MoshpitProcessingIndicator, {
    props,
    global: { plugins: [createPinia(), i18n] }
  })

describe('MoshpitProcessingIndicator (Wave 4)', () => {
  it('renders "Processing N / M" with the supplied counts', () => {
    mountPill({ done: 3, total: 10 })
    expect(screen.getByText(/Processing 3 \/ 10/)).toBeInTheDocument()
  })

  it('emits `cancel` when the × button is clicked', async () => {
    const { emitted } = mountPill({ done: 1, total: 5 })
    const btn = screen.getByRole('button', { name: /cancel processing/i })
    await userEvent.click(btn)
    expect(emitted().cancel).toBeTruthy()
  })

  it('exposes progressbar role with aria-valuenow / valuemin / valuemax', () => {
    mountPill({ done: 4, total: 8 })
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '4')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '8')
  })

  it('announces updates via role="status" aria-live="polite"', () => {
    mountPill({ done: 0, total: 1 })
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })
})
