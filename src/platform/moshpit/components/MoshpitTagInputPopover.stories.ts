import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

import { useMoshpitCurationStore } from '@/platform/moshpit/stores/moshpitCurationStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'

import MoshpitTagInputPopover from './MoshpitTagInputPopover.vue'

const meta: Meta<typeof MoshpitTagInputPopover> = {
  title: 'platform/moshpit/MoshpitTagInputPopover',
  component: MoshpitTagInputPopover,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      components: { story },
      setup() {
        setActivePinia(createPinia())
      },
      template: `
        <div style="min-height: 200px; padding: 16px; background: var(--comfy-menu-bg, #1a1a1a);">
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof MoshpitTagInputPopover>

const stubParams = {
  model: undefined,
  loras: [],
  cfg: undefined,
  steps: undefined,
  sampler: undefined,
  scheduler: undefined,
  seed: undefined,
  positivePrompt: undefined,
  negativePrompt: undefined,
  width: undefined,
  height: undefined,
  timestamp: 0,
  workflowFingerprint: '',
  workflowFilename: null,
  saveNodeIdentity: null
}

/**
 * Default story — popover open with 3 selected hashes and 2 existing tags.
 * 'hero' is applied to all selected (tristate=all), 'cinematic' is applied to
 * some (tristate=some), and the popover shows the inline input at the top.
 */
export const Default: Story = {
  render: () => ({
    components: { MoshpitTagInputPopover },
    setup() {
      const pinia = createPinia()
      setActivePinia(pinia)
      const metaStore = useMoshpitMetadataStore()
      const curationStore = useMoshpitCurationStore()

      metaStore.paramsByHash.set('h1', stubParams)
      metaStore.paramsByHash.set('h2', stubParams)
      metaStore.paramsByHash.set('h3', stubParams)

      // 'hero' on all 3 → tristate=all
      curationStore.curationByHash.set('h1', {
        favourite: false,
        tags: ['hero', 'cinematic'],
        folders: [],
        hidden: false
      })
      curationStore.curationByHash.set('h2', {
        favourite: false,
        tags: ['hero'],
        folders: [],
        hidden: false
      })
      curationStore.curationByHash.set('h3', {
        favourite: false,
        tags: ['hero'],
        folders: [],
        hidden: false
      })

      const open = ref(true)
      const hashes = ['h1', 'h2', 'h3']
      return { open, hashes }
    },
    template: `<MoshpitTagInputPopover v-model:open="open" :hashes="hashes" />`
  })
}

/**
 * Empty story — popover open with no existing tags. Shows only the input.
 */
export const Empty: Story = {
  render: () => ({
    components: { MoshpitTagInputPopover },
    setup() {
      const pinia = createPinia()
      setActivePinia(pinia)
      const open = ref(true)
      const hashes = ['h1', 'h2']
      return { open, hashes }
    },
    template: `<MoshpitTagInputPopover v-model:open="open" :hashes="hashes" />`
  })
}
