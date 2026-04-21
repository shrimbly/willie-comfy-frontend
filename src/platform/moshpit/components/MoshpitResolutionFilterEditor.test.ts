import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'
import type { NormalizedParams } from '@/platform/moshpit/services/paramNormalize'
import MoshpitResolutionFilterEditor from './MoshpitResolutionFilterEditor.vue'

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
  return render(MoshpitResolutionFilterEditor, {
    props: { param: 'resolution', modelValue: null },
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitResolutionFilterEditor', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renders discovered resolution pairs as checkboxes', async () => {
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams('h1', makeParams({ width: 512, height: 512 }))
    metaStore.setParams('h2', makeParams({ width: 768, height: 768 }))

    mountEditor()

    const checkboxes = await screen.findAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThanOrEqual(2)
  })

  it('checking a discovered pair emits resolution ChipValue', async () => {
    const user = userEvent.setup()
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams('h1', makeParams({ width: 512, height: 512 }))

    const { emitted } = mountEditor()

    await screen.findByRole('checkbox')
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    const updates = emitted<unknown[]>('update:modelValue')
    expect(updates).toBeTruthy()
    const lastUpdate = updates![updates!.length - 1][0]
    expect(lastUpdate).toMatchObject({ kind: 'resolution', pairs: [[512, 512]] })
  })

  it('unchecking all pairs emits null', async () => {
    const user = userEvent.setup()
    const metaStore = useMoshpitMetadataStore()
    metaStore.setParams('h1', makeParams({ width: 512, height: 512 }))

    const { emitted } = mountEditor()

    await screen.findByRole('checkbox')
    const checkbox = screen.getByRole('checkbox')

    await user.click(checkbox)
    await user.click(checkbox)

    const updates = emitted<unknown[]>('update:modelValue')
    const lastUpdate = updates![updates!.length - 1][0]
    expect(lastUpdate).toBeNull()
  })

  it('custom W+H inputs are rendered for adding a custom resolution', () => {
    mountEditor()
    const inputs = screen.getAllByRole('spinbutton')
    // W and H inputs
    expect(inputs.length).toBeGreaterThanOrEqual(2)
  })

  it('clicking the + button with valid custom W+H emits the custom pair', async () => {
    const user = userEvent.setup()
    const { emitted } = mountEditor()

    const spinbuttons = screen.getAllByRole('spinbutton')
    // W input is first, H input is second
    await user.type(spinbuttons[0], '1024')
    await user.type(spinbuttons[1], '768')

    const addBtn = screen.getByRole('button', { name: '+' })
    await user.click(addBtn)

    const updates = emitted<unknown[]>('update:modelValue')
    expect(updates).toBeTruthy()
    const lastUpdate = updates![updates!.length - 1][0]
    expect(lastUpdate).toMatchObject({ kind: 'resolution', pairs: [[1024, 768]] })
  })
})
