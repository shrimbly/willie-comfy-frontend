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

  return {
    id: 'assets',
    icon: 'icon-[comfy--image-ai-edit]',
    title: 'sideToolbar.assets',
    tooltip: 'sideToolbar.assets',
    label: 'sideToolbar.labels.assets',
    component: markRaw(AssetsSidebarTab),
    type: 'vue',
    get panelSize() {
      if (!showAllAssets.value) return 20
      return showFilterPanel.value ? 30 : 25
    },
    get panelMinSize() {
      if (!showAllAssets.value) return 15
      return showFilterPanel.value ? 25 : 20
    },
    get panelStateKeySuffix() {
      if (!showAllAssets.value) return ''
      return showFilterPanel.value ? 'directory-filters' : 'directory'
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
