import { useStorage } from '@vueuse/core'
import { markRaw } from 'vue'

import AssetsSidebarTab from '@/components/sidebar/tabs/AssetsSidebarTab.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAssetsSidebarBadgeStore } from '@/stores/workspace/assetsSidebarBadgeStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

const PANEL_SIZE = 40
const DETAIL_PANEL_WIDTH_PX = 200

export const useAssetsSidebarTab = (): SidebarTabExtension => {
  const showDetailPanel = useStorage<boolean>(
    'Comfy.Assets.ShowDetailPanel',
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
    panelSize: PANEL_SIZE,
    panelMinSize: PANEL_SIZE,
    panelStateKeySuffix: 'recents-folders',
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
