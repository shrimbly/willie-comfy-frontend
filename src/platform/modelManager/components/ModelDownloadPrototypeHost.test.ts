import { createPinia, setActivePinia } from 'pinia'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ModelDownloadPrototypeHost from './ModelDownloadPrototypeHost.vue'

const mockHydrate = vi.hoisted(() => vi.fn())

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: { serverSideModelDownloads: true }
  })
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ isBuilderMode: false })
}))

vi.mock('../stores/modelDownloadStore', () => ({
  useModelDownloadStore: () => ({ hydrate: mockHydrate })
}))

describe('ModelDownloadPrototypeHost', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockHydrate.mockReset()
    mockHydrate.mockResolvedValue(undefined)
  })

  it('hydrates downloads without opening the Downloads panel', () => {
    render(ModelDownloadPrototypeHost, {
      global: {
        stubs: {
          ModelDownloadPrototypeSwitcher: true,
          ModelDownloadFloatingTracker: true
        }
      }
    })

    expect(mockHydrate).toHaveBeenCalledOnce()
  })

  it('handles hydration failures during startup', async () => {
    mockHydrate.mockRejectedValueOnce(new Error('backend unavailable'))

    render(ModelDownloadPrototypeHost, {
      global: {
        stubs: {
          ModelDownloadPrototypeSwitcher: true,
          ModelDownloadFloatingTracker: true
        }
      }
    })
    await Promise.resolve()

    expect(mockHydrate).toHaveBeenCalledOnce()
  })
})
