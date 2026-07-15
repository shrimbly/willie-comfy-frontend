import { createPinia, setActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { useModelDownloadUiStore } from '../stores/modelDownloadUiStore'
import ModelDownloadPrototypeSwitcher from './ModelDownloadPrototypeSwitcher.vue'

const mockFlags = vi.hoisted(() => ({ serverSideModelDownloads: true }))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: mockFlags })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

describe('ModelDownloadPrototypeSwitcher', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockFlags.serverSideModelDownloads = true
  })

  it('switches between all download tracking placements', async () => {
    const user = userEvent.setup()
    render(ModelDownloadPrototypeSwitcher, {
      global: { plugins: [i18n] }
    })
    const uiStore = useModelDownloadUiStore()

    expect(screen.getByRole('button', { name: 'Floating' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await user.click(screen.getByRole('button', { name: 'Top bar' }))
    expect(uiStore.trackingPlacement).toBe('topbar')

    await user.click(screen.getByRole('button', { name: 'Sidebar' }))
    expect(uiStore.trackingPlacement).toBe('sidebar')

    await user.click(screen.getByRole('button', { name: 'Floating' }))
    expect(uiStore.trackingPlacement).toBe('floating')
  })

  it('stays hidden when server-side downloads are unavailable', () => {
    mockFlags.serverSideModelDownloads = false
    render(ModelDownloadPrototypeSwitcher, {
      global: { plugins: [i18n] }
    })

    expect(screen.queryByLabelText('Download tracking')).not.toBeInTheDocument()
  })
})
