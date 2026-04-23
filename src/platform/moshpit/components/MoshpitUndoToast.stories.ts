import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { createPinia, setActivePinia } from 'pinia'

import MoshpitUndoToast from './MoshpitUndoToast.vue'

const meta: Meta<typeof MoshpitUndoToast> = {
  title: 'platform/moshpit/MoshpitUndoToast',
  component: MoshpitUndoToast,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      components: { story },
      setup() {
        setActivePinia(createPinia())
      },
      template: `
        <div style="min-height: 200px; display: flex; align-items: flex-end; justify-content: center; padding: 16px;">
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof MoshpitUndoToast>

/**
 * Default story — mounts the Toast group component. In Storybook, the Toast is
 * portal-rendered by PrimeVue and will only show content when a toast message
 * with group="moshpit-curation" is programmatically added. The component
 * renders an invisible wrapper div until triggered — this story shows the
 * mount is stable and no-crash.
 */
export const Default: Story = {}

/**
 * Shows what the Undo toast looks like when a short action summary is shown.
 * The PrimeVue Toast must be driven by toastStore.add() in real usage — here
 * we document the intended visual shape for implementors.
 */
export const DocumentedShape: Story = {
  render: () => ({
    template: `
      <div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--color-interface-panel-surface, #1e1e1e); border-radius: 8px; border: 1px solid var(--color-border-subtle, #333); font-family: sans-serif; font-size: 14px; color: var(--color-base-foreground, #ccc);">
        <span>Hidden 3 assets</span>
        <button
          type="button"
          style="padding: 4px 8px; border-radius: 6px; background: var(--color-interface-panel-surface, #2a2a2a); border: 1px solid var(--color-border-subtle, #444); color: var(--color-base-foreground, #ccc); cursor: pointer; font-size: 13px;"
        >Undo</button>
      </div>
    `
  })
}
