import type { Meta, StoryObj } from '@storybook/vue3-vite'

import MoshpitLayout from './MoshpitLayout.vue'

const meta: Meta<typeof MoshpitLayout> = {
  title: 'views/layouts/MoshpitLayout',
  component: MoshpitLayout,
  parameters: {
    layout: 'fullscreen'
  }
}

export default meta
type Story = StoryObj<typeof MoshpitLayout>

export const Default: Story = {
  render: () => ({
    components: { MoshpitLayout },
    template: '<div style="height: 100vh;"><MoshpitLayout /></div>'
  })
}
