import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import MetadataSearchInput from '@/platform/assets/components/MetadataSearchInput.vue'
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
          searchPlaceholder: 'Search or type @ to filter',
          enterValue: 'Type {field} value...',
          noMatches: 'No matches',
          group: {
            metadata: 'Metadata',
            attributes: 'Attributes',
            values: 'Values',
            recent: 'Recent',
            custom: 'Custom'
          },
          addCustom: 'Add as custom filter',
          descriptions: {
            model: 'Filter by model name',
            lora: 'Filter by LoRA',
            workflowTitle: 'Filter by workflow title',
            prompt: 'Filter by prompt text',
            date: 'Filter by date',
            tag: 'Filter by tag',
            type: 'Filter by media type'
          },
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

function renderInput(
  options: {
    initialQuery?: string
    initialFilters?: MetadataFilter[]
    availableTags?: string[]
    availableValuesByField?: Record<
      'model' | 'lora' | 'workflowTitle',
      string[]
    >
  } = {}
) {
  const searchQuery = ref(options.initialQuery ?? '')
  const metadataFilters = ref<MetadataFilter[]>(options.initialFilters ?? [])

  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(MetadataSearchInput, {
          searchQuery: searchQuery.value,
          'onUpdate:searchQuery': (v: string) => (searchQuery.value = v),
          metadataFilters: metadataFilters.value,
          'onUpdate:metadataFilters': (v: MetadataFilter[]) =>
            (metadataFilters.value = v),
          availableTags: options.availableTags ?? [],
          availableValuesByField: options.availableValuesByField
        })
    }
  })

  const utils = render(Wrapper, { global: { plugins: [i18n] } })
  return { ...utils, searchQuery, metadataFilters }
}

async function typeAtTrigger(input: HTMLInputElement) {
  // userEvent.type of '@' does not reliably fire our handleInput because
  // the combobox intercepts input events; set the value then fire input
  // directly so `value.endsWith('@')` fires through handleInput.
  await fireEvent.update(input, '@')
}

describe('MetadataSearchInput', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the search input with placeholder', () => {
    renderInput()
    expect(
      screen.getByPlaceholderText('Search or type @ to filter')
    ).toBeInTheDocument()
  })

  it('opens the grouped suggestions when @ is typed', async () => {
    renderInput()
    const input = screen.getByPlaceholderText(
      'Search or type @ to filter'
    ) as HTMLInputElement
    await typeAtTrigger(input)

    expect(await screen.findByText('Metadata')).toBeInTheDocument()
    expect(screen.getByText('Attributes')).toBeInTheDocument()
    expect(screen.getByText('Filter by model name')).toBeInTheDocument()
    expect(screen.getByText('Filter by date')).toBeInTheDocument()
  })

  it('selecting a field with options swaps to the values group', async () => {
    const user = userEvent.setup()
    renderInput()
    const input = screen.getByPlaceholderText(
      'Search or type @ to filter'
    ) as HTMLInputElement
    await typeAtTrigger(input)

    await user.click(await screen.findByText('Filter by date'))

    expect(await screen.findByText('Values')).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('This week')).toBeInTheDocument()
  })

  it('selecting an option adds a metadata filter', async () => {
    const user = userEvent.setup()
    const { metadataFilters } = renderInput()
    const input = screen.getByPlaceholderText(
      'Search or type @ to filter'
    ) as HTMLInputElement
    await typeAtTrigger(input)

    await user.click(await screen.findByText('Filter by date'))
    await user.click(await screen.findByText('Today'))

    expect(metadataFilters.value).toEqual([{ field: 'date', value: 'today' }])
  })

  it('removes the last filter on Backspace with empty input', async () => {
    const user = userEvent.setup()
    const { metadataFilters } = renderInput({
      initialFilters: [
        { field: 'tag', value: 'hero' },
        { field: 'type', value: 'image' }
      ]
    })

    const input = screen.getByRole('combobox') as HTMLInputElement
    input.focus()
    await user.keyboard('{Backspace}')

    expect(metadataFilters.value).toEqual([{ field: 'tag', value: 'hero' }])
  })

  it('filters field suggestions by typed query', async () => {
    renderInput()
    const input = screen.getByPlaceholderText(
      'Search or type @ to filter'
    ) as HTMLInputElement
    await typeAtTrigger(input)

    await fireEvent.update(input, 'lor')

    expect(await screen.findByText('Filter by LoRA')).toBeInTheDocument()
    expect(screen.queryByText('Filter by model name')).not.toBeInTheDocument()
  })

  it('shows extracted values for model/lora/workflowTitle fields', async () => {
    const user = userEvent.setup()
    renderInput({
      availableValuesByField: {
        model: ['sd-xl.safetensors', 'flux-dev.safetensors'],
        lora: [],
        workflowTitle: []
      }
    })
    const input = screen.getByPlaceholderText(
      'Search or type @ to filter'
    ) as HTMLInputElement
    await typeAtTrigger(input)

    await user.click(await screen.findByText('Filter by model name'))

    expect(await screen.findByText('sd-xl.safetensors')).toBeInTheDocument()
    expect(screen.getByText('flux-dev.safetensors')).toBeInTheDocument()
  })

  it('commits a picked model value as a filter', async () => {
    const user = userEvent.setup()
    const { metadataFilters } = renderInput({
      availableValuesByField: {
        model: ['sd-xl.safetensors'],
        lora: [],
        workflowTitle: []
      }
    })
    const input = screen.getByPlaceholderText(
      'Search or type @ to filter'
    ) as HTMLInputElement
    await typeAtTrigger(input)

    await user.click(await screen.findByText('Filter by model name'))
    await user.click(await screen.findByText('sd-xl.safetensors'))

    expect(metadataFilters.value).toEqual([
      { field: 'model', value: 'sd-xl.safetensors' }
    ])
  })

  it('shows a custom-value ghost row for model when typed text does not match', async () => {
    const user = userEvent.setup()
    const { metadataFilters } = renderInput({
      availableValuesByField: {
        model: ['sd-xl.safetensors'],
        lora: [],
        workflowTitle: []
      }
    })
    const input = screen.getByPlaceholderText(
      'Search or type @ to filter'
    ) as HTMLInputElement
    await typeAtTrigger(input)
    await user.click(await screen.findByText('Filter by model name'))

    await fireEvent.update(input, 'custom-model-xyz')

    expect(await screen.findByText('Custom')).toBeInTheDocument()
    expect(screen.getByText('Add as custom filter')).toBeInTheDocument()

    await user.click(screen.getByText('Add as custom filter'))

    expect(metadataFilters.value).toEqual([
      { field: 'model', value: 'custom-model-xyz' }
    ])
  })

  it('surfaces recently used values in a Recent group', async () => {
    const user = userEvent.setup()
    const { metadataFilters, rerender } = renderInput({
      availableValuesByField: {
        model: ['sd-xl.safetensors', 'flux-dev.safetensors'],
        lora: [],
        workflowTitle: []
      }
    })
    const input = screen.getByPlaceholderText(
      'Search or type @ to filter'
    ) as HTMLInputElement
    await typeAtTrigger(input)
    await user.click(await screen.findByText('Filter by model name'))
    await user.click(await screen.findByText('sd-xl.safetensors'))

    expect(metadataFilters.value).toEqual([
      { field: 'model', value: 'sd-xl.safetensors' }
    ])

    // Remove the chip so we can re-trigger the filter flow
    input.focus()
    await user.keyboard('{Backspace}')
    expect(metadataFilters.value).toEqual([])

    // Re-trigger — the committed value should now appear under "Recent"
    await rerender({})
    await typeAtTrigger(input)
    await user.click(await screen.findByText('Filter by model name'))

    expect(await screen.findByText('Recent')).toBeInTheDocument()
    // 'sd-xl.safetensors' now lives in the Recent group, deduped from Values
    expect(screen.getAllByText('sd-xl.safetensors')).toHaveLength(1)
  })

  it('fuzzy-matches field names on partial typed query', async () => {
    renderInput()
    const input = screen.getByPlaceholderText(
      'Search or type @ to filter'
    ) as HTMLInputElement
    await typeAtTrigger(input)

    await fireEvent.update(input, 'mod')
    expect(await screen.findByText('Filter by model name')).toBeInTheDocument()
  })
})
