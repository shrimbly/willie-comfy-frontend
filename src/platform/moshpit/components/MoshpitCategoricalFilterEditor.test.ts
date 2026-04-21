import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import type { NormalizedParams } from '@/platform/moshpit/services/paramNormalize'
import MoshpitCategoricalFilterEditor from './MoshpitCategoricalFilterEditor.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function makeParams(overrides: Partial<NormalizedParams> = {}): NormalizedParams {
  return {
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
    workflowFingerprint: 'test',
    workflowFilename: null,
    saveNodeIdentity: null,
    ...overrides
  }
}

let pinia = createPinia()

function mountEditor() {
  return render(MoshpitCategoricalFilterEditor, {
    props: { param: 'sampler', modelValue: null },
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitCategoricalFilterEditor', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renders options derived from the metadata store', async () => {
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams('h1', makeParams({ sampler: 'euler' }))
    metaStore.setParams('h2', makeParams({ sampler: 'dpmpp_2m' }))

    mountEditor()

    await screen.findByText('euler')
    expect(screen.getByText('dpmpp_2m')).toBeInTheDocument()
  })

  it('fuzzy search narrows the option list', async () => {
    const user = userEvent.setup()
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams('h1', makeParams({ sampler: 'euler' }))
    metaStore.setParams('h2', makeParams({ sampler: 'dpmpp_2m' }))

    mountEditor()

    const searchInput = screen.getByPlaceholderText(
      enMessages.moshpit.filters.editorSearchValues
    )
    await user.type(searchInput, 'euler')

    await waitFor(() => {
      expect(screen.getByText('euler')).toBeInTheDocument()
      expect(screen.queryByText('dpmpp_2m')).not.toBeInTheDocument()
    })
  })

  it('checking a value emits categorical ChipValue', async () => {
    const user = userEvent.setup()
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams('h1', makeParams({ sampler: 'euler' }))

    const { emitted } = mountEditor()

    await screen.findByText('euler')
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    const updates = emitted<unknown[]>('update:modelValue')
    expect(updates).toBeTruthy()
    const lastUpdate = updates![updates!.length - 1][0]
    expect(lastUpdate).toMatchObject({ kind: 'categorical', values: ['euler'] })
  })

  it('unchecking all values emits null', async () => {
    const user = userEvent.setup()
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams('h1', makeParams({ sampler: 'euler' }))

    const { emitted } = mountEditor()

    await screen.findByText('euler')
    const checkbox = screen.getByRole('checkbox')

    // Check then uncheck
    await user.click(checkbox)
    await user.click(checkbox)

    const updates = emitted<unknown[]>('update:modelValue')
    const lastUpdate = updates![updates!.length - 1][0]
    expect(lastUpdate).toBeNull()
  })

  it('renders the search input with i18n placeholder', () => {
    mountEditor()
    expect(
      screen.getByPlaceholderText(enMessages.moshpit.filters.editorSearchValues)
    ).toBeInTheDocument()
  })
})
