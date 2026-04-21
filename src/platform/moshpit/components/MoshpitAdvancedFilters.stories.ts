import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { createPinia, setActivePinia } from 'pinia'

import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import MoshpitAdvancedFilters from './MoshpitAdvancedFilters.vue'

function seed({
  open,
  withChips
}: {
  readonly open: boolean
  readonly withChips: boolean
}): void {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useMoshpitFilterStore()
  store.setAdvancedOpen(open)
  if (withChips) {
    store.addChip({
      id: 'cfg-chip',
      param: 'cfg',
      value: { kind: 'numeric', min: 6, max: 8, exact: null }
    })
    store.addChip({
      id: 'sampler-chip',
      param: 'sampler',
      value: { kind: 'categorical', values: ['euler'] }
    })
  }
}

const meta: Meta<typeof MoshpitAdvancedFilters> = {
  title: 'platform/moshpit/MoshpitAdvancedFilters',
  component: MoshpitAdvancedFilters,
  render: () => ({
    components: { MoshpitAdvancedFilters },
    template:
      '<div style="padding: 16px; width: 320px; background: #1a1a1a;"><MoshpitAdvancedFilters /></div>'
  })
}

export default meta
type Story = StoryObj<typeof MoshpitAdvancedFilters>

export const Closed: Story = {
  beforeEach: () => seed({ open: false, withChips: false })
}

export const Open: Story = {
  beforeEach: () => seed({ open: true, withChips: false })
}

export const OpenWithChips: Story = {
  beforeEach: () => seed({ open: true, withChips: true })
}
