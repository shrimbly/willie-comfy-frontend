import { useStorage } from '@vueuse/core'
import { markRaw } from 'vue'

import AssetsSidebarTab from '@/components/sidebar/tabs/AssetsSidebarTab.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAssetsSidebarBadgeStore } from '@/stores/workspace/assetsSidebarBadgeStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useAssetsSidebarTab = (): SidebarTabExtension => {
  const showAllAssets = useStorage<boolean>('Comfy.Assets.ShowAllAssets', false)
  const showFilterPanel = useStorage<boolean>(
    'Comfy.Assets.ShowFilterPanel',
    false
  )
  const showDetailPanel = useStorage<boolean>(
    'Comfy.Assets.ShowDetailPanel',
    false
  )
  const directoryLayout = useStorage<'filters' | 'folders'>(
    'Comfy.Assets.DirectoryLayout',
    'filters'
  )
  const recentsSidebar = useStorage<boolean>(
    'Comfy.Assets.RecentsSidebar',
    false
  )

  const DETAIL_PANEL_WIDTH_PX = 200

  const isFoldersLayout = () =>
    showAllAssets.value && directoryLayout.value === 'folders'
  const isRecentsSidebar = () => recentsSidebar.value

  return {
    id: 'assets',
    icon: 'icon-[comfy--image-ai-edit]',
    title: 'sideToolbar.assets',
    tooltip: 'sideToolbar.assets',
    label: 'sideToolbar.labels.assets',
    component: markRaw(AssetsSidebarTab),
    type: 'vue',
    get panelSize() {
      if (isRecentsSidebar()) return 40
      if (!showAllAssets.value) return 20
      if (isFoldersLayout()) return 35
      return showFilterPanel.value ? 30 : 25
    },
    get panelMinSize() {
      if (isRecentsSidebar()) return 40
      if (!showAllAssets.value) return 15
      if (isFoldersLayout()) return 30
      return showFilterPanel.value ? 25 : 20
    },
    get panelStateKeySuffix() {
      if (isRecentsSidebar()) return 'recents-folders'
      if (!showAllAssets.value) return ''
      if (isFoldersLayout()) return 'directory-folders'
      return showFilterPanel.value ? 'directory-filters' : 'directory'
    },
    get panelExtraWidthPx() {
      return showDetailPanel.value ? DETAIL_PANEL_WIDTH_PX : 0
    },
    iconBadge: () => {
      const settingStore = useSettingStore()

      if (!settingStore.get('Comfy.Queue.QPOV2')) {
        return null
      }

      const assetsSidebarBadgeStore = useAssetsSidebarBadgeStore()
      const count = assetsSidebarBadgeStore.unseenAddedAssetsCount
      return count > 0 ? count.toString() : null
    }
  }
}
