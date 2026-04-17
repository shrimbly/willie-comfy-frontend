import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAssetsSidebarTab } from '@/composables/sidebarTabs/useAssetsSidebarTab'

const { mockGetSetting, mockUnseenAddedAssetsCount } = vi.hoisted(() => ({
  mockGetSetting: vi.fn(),
  mockUnseenAddedAssetsCount: { value: 0 }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting
  })
}))

vi.mock('@/components/sidebar/tabs/AssetsSidebarTab.vue', () => ({
  default: {}
}))

vi.mock('@/stores/workspace/assetsSidebarBadgeStore', () => ({
  useAssetsSidebarBadgeStore: () => ({
    unseenAddedAssetsCount: mockUnseenAddedAssetsCount.value
  })
}))

describe('useAssetsSidebarTab', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('hides icon badge when QPO V2 is disabled', () => {
    mockGetSetting.mockReturnValue(false)
    mockUnseenAddedAssetsCount.value = 3

    const sidebarTab = useAssetsSidebarTab()

    expect(typeof sidebarTab.iconBadge).toBe('function')
    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })

  it('shows unseen added assets count when QPO V2 is enabled', () => {
    mockGetSetting.mockReturnValue(true)
    mockUnseenAddedAssetsCount.value = 3

    const sidebarTab = useAssetsSidebarTab()

    expect(typeof sidebarTab.iconBadge).toBe('function')
    expect((sidebarTab.iconBadge as () => string | null)()).toBe('3')
  })

  it('hides badge when there are no unseen added assets', () => {
    mockGetSetting.mockReturnValue(true)
    mockUnseenAddedAssetsCount.value = 0

    const sidebarTab = useAssetsSidebarTab()

    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })

  it('uses compact width defaults when advanced view is disabled', () => {
    const sidebarTab = useAssetsSidebarTab()

    expect(sidebarTab.panelSize).toBe(20)
    expect(sidebarTab.panelMinSize).toBe(15)
    expect(sidebarTab.panelStateKeySuffix).toBe('')
  })

  it('uses directory width when ShowAllAssets is true without filter panel', () => {
    localStorage.setItem('Comfy.Assets.ShowAllAssets', 'true')

    const sidebarTab = useAssetsSidebarTab()

    expect(sidebarTab.panelSize).toBe(25)
    expect(sidebarTab.panelMinSize).toBe(20)
    expect(sidebarTab.panelStateKeySuffix).toBe('directory')
  })

  it('uses wider width when both directory view and filter panel are open', () => {
    localStorage.setItem('Comfy.Assets.ShowAllAssets', 'true')
    localStorage.setItem('Comfy.Assets.ShowFilterPanel', 'true')

    const sidebarTab = useAssetsSidebarTab()

    expect(sidebarTab.panelSize).toBe(30)
    expect(sidebarTab.panelMinSize).toBe(25)
    expect(sidebarTab.panelStateKeySuffix).toBe('directory-filters')
  })
})
