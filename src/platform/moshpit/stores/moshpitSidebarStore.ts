import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const MOSHPIT_SETTINGS_PANEL_ID = 'settings'

export const useMoshpitSidebarStore = defineStore('moshpitSidebar', () => {
  const activePanelId = ref<string | null>(MOSHPIT_SETTINGS_PANEL_ID)
  const hasHadFirstInteraction = ref(false)

  const isPanelOpen = computed(() => activePanelId.value !== null)

  function collapseOnFirstClick() {
    if (hasHadFirstInteraction.value) return
    hasHadFirstInteraction.value = true
    activePanelId.value = null
  }

  function openPanel(id: string) {
    activePanelId.value = id
    hasHadFirstInteraction.value = true
  }

  function closePanel() {
    activePanelId.value = null
  }

  function togglePanel(id: string) {
    if (activePanelId.value === id) {
      activePanelId.value = null
    } else {
      activePanelId.value = id
      hasHadFirstInteraction.value = true
    }
  }

  return {
    activePanelId,
    hasHadFirstInteraction,
    isPanelOpen,
    collapseOnFirstClick,
    openPanel,
    closePanel,
    togglePanel
  }
})
