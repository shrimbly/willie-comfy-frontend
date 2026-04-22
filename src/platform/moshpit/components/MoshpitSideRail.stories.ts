import type { Meta, StoryObj } from '@storybook/vue3-vite'

import {
  MOSHPIT_SETTINGS_PANEL_ID,
  useMoshpitSidebarStore
} from '@/platform/moshpit/stores/moshpitSidebarStore'

import MoshpitSideRail from './MoshpitSideRail.vue'

const meta: Meta<typeof MoshpitSideRail> = {
  title: 'platform/moshpit/MoshpitSideRail',
  component: MoshpitSideRail
}

export default meta
type Story = StoryObj<typeof MoshpitSideRail>

export const PanelOpen: Story = {
  render: () => ({
    components: { MoshpitSideRail },
    setup() {
      const store = useMoshpitSidebarStore()
      store.openPanel(MOSHPIT_SETTINGS_PANEL_ID)
      return {}
    },
    template:
      '<div style="height: 400px; display: flex;"><MoshpitSideRail /></div>'
  })
}

export const PanelCollapsed: Story = {
  render: () => ({
    components: { MoshpitSideRail },
    setup() {
      const store = useMoshpitSidebarStore()
      store.closePanel()
      return {}
    },
    template:
      '<div style="height: 400px; display: flex;"><MoshpitSideRail /></div>'
  })
}
