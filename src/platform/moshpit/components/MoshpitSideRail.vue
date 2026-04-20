<template>
  <nav
    data-testid="moshpit-side-rail"
    class="flex h-full flex-col items-center border-r border-(--interface-stroke) bg-node-component-surface"
  >
    <div class="flex flex-col items-center gap-1 p-1">
      <SidebarIcon
        icon="pi pi-cog"
        :tooltip="t('moshpit.sidebar.toggleSettings')"
        :label="t('moshpit.sidebar.settings')"
        :selected="isSettingsActive"
        :is-small="false"
        data-testid="moshpit-settings-tab"
        @click="onSettingsClick"
      />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SidebarIcon from '@/components/sidebar/SidebarIcon.vue'
import {
  MOSHPIT_SETTINGS_PANEL_ID,
  useMoshpitSidebarStore
} from '@/platform/moshpit/stores/moshpitSidebarStore'

defineOptions({ name: 'MoshpitSideRail' })

const { t } = useI18n()
const sidebarStore = useMoshpitSidebarStore()

const isSettingsActive = computed(
  () => sidebarStore.activePanelId === MOSHPIT_SETTINGS_PANEL_ID
)

function onSettingsClick() {
  sidebarStore.togglePanel(MOSHPIT_SETTINGS_PANEL_ID)
}
</script>
