import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { createPinia, setActivePinia } from 'pinia'

import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import type { GroupingAxis } from '@/platform/moshpit/services/groupAxes'
import { GROUPING_AXES } from '@/platform/moshpit/services/groupAxes'
import MoshpitGroupingToggles from './MoshpitGroupingToggles.vue'

function seedActiveGroupings(axes: readonly GroupingAxis[]): void {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useMoshpitFilterStore()
  for (const axis of axes) store.toggleGrouping(axis)
}

const meta: Meta<typeof MoshpitGroupingToggles> = {
  title: 'platform/moshpit/MoshpitGroupingToggles',
  component: MoshpitGroupingToggles,
  render: () => ({
    components: { MoshpitGroupingToggles },
    template:
      '<div style="padding: 16px; width: 320px; background: #1a1a1a;"><MoshpitGroupingToggles /></div>'
  })
}

export default meta
type Story = StoryObj<typeof MoshpitGroupingToggles>

export const Default: Story = {
  beforeEach: () => {
    seedActiveGroupings([])
  }
}

export const WithOneActive: Story = {
  beforeEach: () => {
    seedActiveGroupings(['workflow'])
  }
}

export const AllActive: Story = {
  beforeEach: () => {
    seedActiveGroupings(GROUPING_AXES)
  }
}
