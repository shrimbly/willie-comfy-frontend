import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { createPinia, setActivePinia } from 'pinia'

import { useMoshpitCurationStore } from '@/platform/moshpit/stores/moshpitCurationStore'
import { useMoshpitFoldersStore } from '@/platform/moshpit/stores/moshpitFoldersStore'

import MoshpitFoldersSection from './MoshpitFoldersSection.vue'

const meta: Meta<typeof MoshpitFoldersSection> = {
  title: 'platform/moshpit/MoshpitFoldersSection',
  component: MoshpitFoldersSection,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      components: { story },
      setup() {
        setActivePinia(createPinia())
      },
      template: `
        <div style="width: 240px; padding: 12px; background: var(--comfy-menu-bg, #1a1a1a);">
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof MoshpitFoldersSection>

/**
 * Empty state — no folders have been created yet.
 */
export const Empty: Story = {}

/**
 * WithFolders — two folders with member counts.
 */
export const WithFolders: Story = {
  render: () => ({
    components: { MoshpitFoldersSection },
    setup() {
      const pinia = createPinia()
      setActivePinia(pinia)
      const foldersStore = useMoshpitFoldersStore()
      const curationStore = useMoshpitCurationStore()

      const idA = foldersStore.create('Cinematic Shots')
      const idB = foldersStore.create('Portrait Winners')
      foldersStore.create('Landscape Picks')

      curationStore.curationByHash.set('h1', {
        favourite: false,
        tags: [],
        folders: [idA, idB],
        hidden: false
      })
      curationStore.curationByHash.set('h2', {
        favourite: false,
        tags: [],
        folders: [idA],
        hidden: false
      })
      curationStore.curationByHash.set('h3', {
        favourite: false,
        tags: [],
        folders: [idB],
        hidden: false
      })

      return {}
    },
    template: `<MoshpitFoldersSection />`
  })
}

/**
 * Creating — the new folder inline input is visible.
 */
export const Creating: Story = {
  render: () => ({
    components: { MoshpitFoldersSection },
    setup() {
      const pinia = createPinia()
      setActivePinia(pinia)
      const foldersStore = useMoshpitFoldersStore()
      foldersStore.create('Existing Folder')
      return {}
    },
    template: `<MoshpitFoldersSection />`
  })
}
