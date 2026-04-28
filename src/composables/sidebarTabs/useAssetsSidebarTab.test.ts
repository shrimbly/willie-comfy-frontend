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

  it('uses fixed panel width tuned for the recents folders sidebar', () => {
    const sidebarTab = useAssetsSidebarTab()

    expect(sidebarTab.panelSize).toBe(40)
    expect(sidebarTab.panelMinSize).toBe(40)
    expect(sidebarTab.panelStateKeySuffix).toBe('recents-folders')
  })

  it('provides extra pixel width when detail panel is open', () => {
    localStorage.setItem('Comfy.Assets.ShowDetailPanel', 'true')

    const sidebarTab = useAssetsSidebarTab()

    expect(sidebarTab.panelExtraWidthPx).toBe(200)
  })

  it('has no extra pixel width when detail panel is closed', () => {
    const sidebarTab = useAssetsSidebarTab()

    expect(sidebarTab.panelExtraWidthPx).toBe(0)
  })
})
