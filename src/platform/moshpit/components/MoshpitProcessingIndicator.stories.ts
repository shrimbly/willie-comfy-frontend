import type { Meta, StoryObj } from '@storybook/vue3-vite'

import MoshpitProcessingIndicator from './MoshpitProcessingIndicator.vue'

const meta: Meta<typeof MoshpitProcessingIndicator> = {
  title: 'platform/moshpit/MoshpitProcessingIndicator',
  component: MoshpitProcessingIndicator
}

export default meta
type Story = StoryObj<typeof MoshpitProcessingIndicator>

export const Processing: Story = {
  args: { done: 12, total: 48 },
  render: (args) => ({
    components: { MoshpitProcessingIndicator },
    setup() {
      return { args }
    },
    template:
      '<div style="position: relative; height: 300px; width: 500px; background: #222;"><MoshpitProcessingIndicator v-bind="args" /></div>'
  })
}

export const NearComplete: Story = {
  args: { done: 47, total: 48 },
  render: (args) => ({
    components: { MoshpitProcessingIndicator },
    setup() {
      return { args }
    },
    template:
      '<div style="position: relative; height: 300px; width: 500px; background: #222;"><MoshpitProcessingIndicator v-bind="args" /></div>'
  })
}
