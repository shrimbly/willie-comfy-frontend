import { createPinia, setActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { DownloadStatus } from '../types'
import { useModelDownloadUiStore } from '../stores/modelDownloadUiStore'
import ModelDownloadFloatingTracker from './ModelDownloadFloatingTracker.vue'

const mockState = vi.hoisted(() => ({
  activeSidebarTabId: null as string | null,
  downloads: [] as DownloadStatus[],
  serverSideModelDownloads: true
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

vi.mock('@/stores/workspace/sidebarTabStore', async () => {
  const { defineStore } = await import('pinia')
  const { computed } = await import('vue')
  return {
    useSidebarTabStore: defineStore('testFloatingSidebarTab', () => ({
      activeSidebarTabId: computed({
        get: () => mockState.activeSidebarTabId,
        set: (value) => {
          mockState.activeSidebarTabId = value
        }
      })
    }))
  }
})

vi.mock('../stores/modelDownloadStore', async () => {
  const { defineStore } = await import('pinia')
  const { computed } = await import('vue')
  return {
    useModelDownloadStore: defineStore('testFloatingModelDownload', () => ({
      downloadList: computed(() => mockState.downloads),
      findByModelId: (modelId: string) =>
        mockState.downloads.find((download) => download.model_id === modelId)
    }))
  }
})

vi.mock('./ModelDownloadRow.vue', () => ({
  default: {
    props: ['download'],
    emits: ['openAuth'],
    template:
      '<div><span>{{ download.download_id }}</span>' +
      "<button @click=\"$emit('openAuth', 'huggingface')\">recover auth</button></div>"
  }
}))

vi.mock('./DownloadAuthDialog.vue', () => ({
  default: {
    props: ['open', 'focusProvider'],
    emits: ['update:open'],
    template:
      '<div data-testid="download-auth-dialog">{{ open }}:{{ focusProvider }}</div>'
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function createDownload(
  overrides: Partial<DownloadStatus> = {}
): DownloadStatus {
  return {
    download_id: 'failed-download',
    model_id: 'checkpoints/model.safetensors',
    url: 'https://huggingface.co/org/model.safetensors',
    status: 'failed',
    priority: 0,
    total_bytes: null,
    bytes_done: 0,
    progress: null,
    speed_bps: null,
    eta_seconds: null,
    segments: null,
    error: '401 Unauthorized',
    created_at: 1,
    updated_at: 2,
    ...overrides
  }
}

function mountTracker() {
  useModelDownloadUiStore().trackingPlacement = 'floating'
  return render(ModelDownloadFloatingTracker, {
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })
}

describe('ModelDownloadFloatingTracker', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockState.activeSidebarTabId = null
    mockState.downloads = []
    mockState.serverSideModelDownloads = true
  })

  it('keeps failed downloads visible and opens auth recovery', async () => {
    mockState.downloads = [createDownload()]
    const user = userEvent.setup()
    mountTracker()

    expect(screen.getByText('failed-download')).toBeInTheDocument()
    expect(screen.getByText('1 download needs attention')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'recover auth' }))
    expect(screen.getByTestId('download-auth-dialog')).toHaveTextContent(
      'true:huggingface'
    )
  })

  it('opens Downloads from the floating tracker', async () => {
    mockState.downloads = [createDownload()]
    const user = userEvent.setup()
    mountTracker()

    await user.click(screen.getByRole('button', { name: 'Open downloads' }))
    expect(mockState.activeSidebarTabId).toBe('model-manager')
  })
})
