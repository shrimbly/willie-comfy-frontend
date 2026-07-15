import { createPinia, setActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { useModelDownloadUiStore } from '../stores/modelDownloadUiStore'
import ModelDownloadTopbarButton from './ModelDownloadTopbarButton.vue'

const mockState = vi.hoisted(() => ({
  activeDownloadCount: 2,
  failedDownloadCount: 0,
  activeSidebarTabId: null as string | null,
  serverSideModelDownloads: true,
  toggleSidebarTab: vi.fn()
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get serverSideModelDownloads() {
        return mockState.serverSideModelDownloads
      }
    }
  })
}))

vi.mock('../stores/modelDownloadStore', async () => {
  const { defineStore } = await import('pinia')
  const { computed } = await import('vue')
  return {
    useModelDownloadStore: defineStore('testModelDownload', () => ({
      activeDownloadCount: computed(() => mockState.activeDownloadCount),
      failedDownloadCount: computed(() => mockState.failedDownloadCount),
      indicatorDownloadCount: computed(
        () => mockState.activeDownloadCount + mockState.failedDownloadCount
      )
    }))
  }
})

vi.mock('@/stores/workspace/sidebarTabStore', async () => {
  const { defineStore } = await import('pinia')
  const { computed } = await import('vue')
  return {
    useSidebarTabStore: defineStore('testSidebarTab', () => ({
      activeSidebarTabId: computed(() => mockState.activeSidebarTabId),
      toggleSidebarTab: mockState.toggleSidebarTab
    }))
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

describe('ModelDownloadTopbarButton', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockState.activeDownloadCount = 2
    mockState.failedDownloadCount = 0
    mockState.activeSidebarTabId = null
    mockState.serverSideModelDownloads = true
    mockState.toggleSidebarTab.mockReset()
  })

  it('shows the active count and opens Downloads in the topbar placement', async () => {
    useModelDownloadUiStore().trackingPlacement = 'topbar'
    const user = userEvent.setup()
    render(ModelDownloadTopbarButton, {
      global: {
        plugins: [i18n],
        directives: { tooltip: () => {} }
      }
    })

    expect(screen.getByText('2')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: 'Open downloads. 2 active downloads'
      })
    )
    expect(mockState.toggleSidebarTab).toHaveBeenCalledWith('model-manager')
  })

  it('announces downloads that need attention', () => {
    mockState.activeDownloadCount = 0
    mockState.failedDownloadCount = 1
    useModelDownloadUiStore().trackingPlacement = 'topbar'
    render(ModelDownloadTopbarButton, {
      global: {
        plugins: [i18n],
        directives: { tooltip: () => {} }
      }
    })

    expect(
      screen.getByRole('button', {
        name: 'Open downloads. 1 download needs attention'
      })
    ).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders only in the topbar placement', () => {
    useModelDownloadUiStore().trackingPlacement = 'floating'
    render(ModelDownloadTopbarButton, {
      global: {
        plugins: [i18n],
        directives: { tooltip: () => {} }
      }
    })

    expect(
      screen.queryByRole('button', { name: 'Open downloads' })
    ).not.toBeInTheDocument()
  })
})
