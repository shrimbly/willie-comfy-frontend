import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import MediaAssetFilterChipsBar from '@/platform/assets/components/MediaAssetFilterChipsBar.vue'
import type { MetadataFilter } from '@/platform/assets/types/metadataFilter'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { remove: 'Remove' },
      assets: {
        metadata: {
          model: 'Model',
          lora: 'LoRA',
          workflowTitle: 'Workflow title',
          prompt: 'Prompt',
          date: 'Date',
          tag: 'Tag',
          type: 'Type',
          datePresets: {
            today: 'Today',
            yesterday: 'Yesterday',
            thisWeek: 'This week',
            lastWeek: 'Last week',
            thisMonth: 'This month',
            lastMonth: 'Last month'
          },
          mediaTypes: {
            image: 'Image',
            video: 'Video',
            audio: 'Audio',
            '3D': '3D'
          }
        }
      }
    }
  }
})

function renderBar(initial: MetadataFilter[]) {
  const filters = ref<MetadataFilter[]>(initial)

  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(MediaAssetFilterChipsBar, {
          modelValue: filters.value,
          'onUpdate:modelValue': (v: MetadataFilter[]) => (filters.value = v)
        })
    }
  })

  const utils = render(Wrapper, { global: { plugins: [i18n] } })
  return { ...utils, filters }
}

describe('MediaAssetFilterChipsBar', () => {
  it('renders nothing when there are no filters', () => {
    const { container } = renderBar([])
    expect(container.textContent).toBe('')
  })

  it('renders a chip with field prefix and value label', () => {
    renderBar([{ field: 'model', value: 'sd-xl.safetensors' }])
    expect(screen.getByText('Model:')).toBeInTheDocument()
    expect(screen.getByText('sd-xl.safetensors')).toBeInTheDocument()
  })

  it('formats date preset values via i18n', () => {
    renderBar([{ field: 'date', value: 'today' }])
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('formats media type values via i18n', () => {
    renderBar([{ field: 'type', value: 'image' }])
    expect(screen.getByText('Image')).toBeInTheDocument()
  })

  it('removes the clicked chip from the model', async () => {
    const user = userEvent.setup()
    const { filters } = renderBar([
      { field: 'tag', value: 'hero' },
      { field: 'type', value: 'image' }
    ])

    const removeButtons = screen.getAllByLabelText('Remove')
    await user.click(removeButtons[0])

    expect(filters.value).toEqual([{ field: 'type', value: 'image' }])
  })
})
