import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { createPinia, setActivePinia } from 'pinia'

import type { WithinClusterSortMode } from '@/platform/moshpit/services/groupAxes'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import MoshpitWithinClusterSort from './MoshpitWithinClusterSort.vue'

function seed(mode: WithinClusterSortMode): void {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useMoshpitFilterStore()
  store.setWithinClusterSort(mode)
}

const meta: Meta<typeof MoshpitWithinClusterSort> = {
  title: 'platform/moshpit/MoshpitWithinClusterSort',
  component: MoshpitWithinClusterSort,
  render: () => ({
    components: { MoshpitWithinClusterSort },
    template:
      '<div style="padding: 16px; width: 240px; background: #1a1a1a;"><MoshpitWithinClusterSort /></div>'
  })
}

export default meta
type Story = StoryObj<typeof MoshpitWithinClusterSort>

export const NewestFirst: Story = {
  beforeEach: () => seed('newestFirst')
}

export const OldestFirst: Story = {
  beforeEach: () => seed('oldestFirst')
}

export const Alphabetical: Story = {
  beforeEach: () => seed('alphabetical')
}
