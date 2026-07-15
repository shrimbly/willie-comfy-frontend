import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ModelDownloadTrackingPlacement = 'floating' | 'topbar' | 'sidebar'

export function shouldShowModelDownloadSidebarIndicator(
  trackingPlacement: ModelDownloadTrackingPlacement,
  managerOpen: boolean,
  topbarAvailable: boolean
): boolean {
  return (
    managerOpen ||
    trackingPlacement === 'sidebar' ||
    (trackingPlacement === 'topbar' && !topbarAvailable)
  )
}

export const useModelDownloadUiStore = defineStore('modelDownloadUi', () => {
  const trackingPlacement = ref<ModelDownloadTrackingPlacement>('floating')

  return { trackingPlacement }
})
