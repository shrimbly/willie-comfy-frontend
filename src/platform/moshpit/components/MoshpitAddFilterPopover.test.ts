import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import MoshpitAddFilterPopover from './MoshpitAddFilterPopover.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

// Stub all 5 editor child components — they have their own unit tests.
// The parent passes data-testid="moshpit-add-filter-editor" as a fallthrough attr
// which will be applied to each stub's root element. Each stub also emits a value
// when clicked to allow testing the Apply button flow.
vi.mock('./MoshpitNumericFilterEditor.vue', () => ({
  default: {
    name: 'MoshpitNumericFilterEditor',
    props: ['modelValue', 'param'],
    emits: ['update:modelValue'],
    template:
      '<div @click="$emit(\'update:modelValue\', { kind: \'numeric\', min: 6, max: 8, exact: null })"><span>numeric-editor</span></div>'
  }
}))

vi.mock('./MoshpitCategoricalFilterEditor.vue', () => ({
  default: {
    name: 'MoshpitCategoricalFilterEditor',
    props: ['modelValue', 'param'],
    emits: ['update:modelValue'],
    template:
      '<div @click="$emit(\'update:modelValue\', { kind: \'categorical\', values: [\'euler\'] })"><span>categorical-editor</span></div>'
  }
}))

vi.mock('./MoshpitTextFilterEditor.vue', () => ({
  default: {
    name: 'MoshpitTextFilterEditor',
    props: ['modelValue', 'param'],
    emits: ['update:modelValue'],
    template:
      '<div @click="$emit(\'update:modelValue\', { kind: \'text\', substring: \'cat\' })"><span>text-editor</span></div>'
  }
}))

vi.mock('./MoshpitResolutionFilterEditor.vue', () => ({
  default: {
    name: 'MoshpitResolutionFilterEditor',
    props: ['modelValue', 'param'],
    emits: ['update:modelValue'],
    template:
      '<div @click="$emit(\'update:modelValue\', { kind: \'resolution\', pairs: [[512, 512]] })"><span>resolution-editor</span></div>'
  }
}))

vi.mock('./MoshpitBooleanFilterEditor.vue', () => ({
  default: {
    name: 'MoshpitBooleanFilterEditor',
    props: ['modelValue', 'param'],
    emits: ['update:modelValue'],
    template:
      '<div @click="$emit(\'update:modelValue\', { kind: \'boolean\', value: true })"><span>boolean-editor</span></div>'
  }
}))

let pinia = createPinia()

function mountPopover() {
  return render(MoshpitAddFilterPopover, {
    global: { plugins: [pinia, i18n] }
  })
}

async function openPopover(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByTestId('moshpit-add-filter-trigger')
  await user.click(trigger)
  await screen.findByPlaceholderText(enMessages.moshpit.filters.searchParams)
}

async function clickParamOption(label: string) {
  const option = await screen.findByRole('option', { name: label })
  fireEvent.click(option)
}

describe('MoshpitAddFilterPopover', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renders trigger button with i18n Add filter label', () => {
    mountPopover()
    expect(screen.getByTestId('moshpit-add-filter-trigger')).toBeInTheDocument()
    expect(screen.getByText(enMessages.moshpit.filters.addFilter)).toBeInTheDocument()
  })

  it('clicking trigger opens popover and renders all 12 params in the param list', async () => {
    const user = userEvent.setup()
    mountPopover()

    await openPopover(user)

    expect(screen.getByText(enMessages.moshpit.filters.paramModel)).toBeInTheDocument()
    expect(screen.getByText(enMessages.moshpit.filters.paramLoras)).toBeInTheDocument()
    expect(screen.getByText(enMessages.moshpit.filters.paramCfg)).toBeInTheDocument()
    expect(screen.getByText(enMessages.moshpit.filters.paramSampler)).toBeInTheDocument()
    expect(screen.getByText(enMessages.moshpit.filters.paramFavourite)).toBeInTheDocument()
  })

  it('typing "CFG" in param search filters the list to show paramCfg', async () => {
    const user = userEvent.setup()
    mountPopover()

    await openPopover(user)

    const searchInput = screen.getByPlaceholderText(enMessages.moshpit.filters.searchParams)
    await user.type(searchInput, 'CFG')

    await waitFor(() => {
      expect(screen.getByText(enMessages.moshpit.filters.paramCfg)).toBeInTheDocument()
      expect(screen.queryByText(enMessages.moshpit.filters.paramFavourite)).not.toBeInTheDocument()
    })
  })

  it('params already active in filterStore.chips have aria-disabled="true"', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    filterStore.addChip({
      id: 'active-cfg',
      param: 'cfg',
      value: { kind: 'numeric', min: 6, max: 8, exact: null }
    })

    mountPopover()
    await openPopover(user)

    const cfgOption = await screen.findByRole('option', {
      name: enMessages.moshpit.filters.paramCfg
    })
    expect(cfgOption).toHaveAttribute('aria-disabled', 'true')
  })

  it('clicking a numeric param transitions to step=value and mounts the dynamic editor', async () => {
    const user = userEvent.setup()
    mountPopover()

    await openPopover(user)
    await clickParamOption(enMessages.moshpit.filters.paramCfg)

    // The dynamic editor wrapper has data-testid="moshpit-add-filter-editor"
    // and the stub renders "numeric-editor" text to identify which editor is mounted
    expect(await screen.findByTestId('moshpit-add-filter-editor')).toBeInTheDocument()
    expect(screen.getByText('numeric-editor')).toBeInTheDocument()
  })

  it('back button returns to step=param (clears draftParam)', async () => {
    const user = userEvent.setup()
    mountPopover()

    await openPopover(user)
    await clickParamOption(enMessages.moshpit.filters.paramCfg)

    // We should be in step 2
    await screen.findByTestId('moshpit-add-filter-editor')

    // Click back button
    const backBtn = screen.getByRole('button', { name: enMessages.moshpit.filters.editorBack })
    await user.click(backBtn)

    // Should be back in step 1 — param list visible, no editor
    await waitFor(() => {
      expect(screen.queryByTestId('moshpit-add-filter-editor')).not.toBeInTheDocument()
    })
    expect(screen.getByText(enMessages.moshpit.filters.paramCfg)).toBeInTheDocument()
  })

  it('Apply button is disabled when no draftValue (canApply is false)', async () => {
    const user = userEvent.setup()
    mountPopover()

    await openPopover(user)
    await clickParamOption(enMessages.moshpit.filters.paramCfg)

    const applyBtn = await screen.findByTestId('moshpit-add-filter-apply')
    expect(applyBtn).toBeDisabled()
  })

  it('Apply with valid draftValue calls filterStore.addChip with correct ChipValue', async () => {
    const user = userEvent.setup()
    const filterStore = useMoshpitFilterStore()
    const addChipSpy = vi.spyOn(filterStore, 'addChip')

    mountPopover()
    await openPopover(user)

    // Select numeric param (cfg)
    await clickParamOption(enMessages.moshpit.filters.paramCfg)

    // Editor stub emits a value when its root div is clicked
    const editorWrapper = await screen.findByTestId('moshpit-add-filter-editor')
    fireEvent.click(editorWrapper)

    // Apply button should be enabled now
    const applyBtn = await screen.findByTestId('moshpit-add-filter-apply')
    await waitFor(() => {
      expect(applyBtn).not.toBeDisabled()
    })

    await user.click(applyBtn)

    expect(addChipSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        param: 'cfg',
        value: { kind: 'numeric', min: 6, max: 8, exact: null }
      })
    )
  })

  it('clicking a boolean param (favourite) mounts the boolean editor stub', async () => {
    const user = userEvent.setup()
    mountPopover()

    await openPopover(user)
    await clickParamOption(enMessages.moshpit.filters.paramFavourite)

    await screen.findByTestId('moshpit-add-filter-editor')
    expect(screen.getByText('boolean-editor')).toBeInTheDocument()
  })
})
