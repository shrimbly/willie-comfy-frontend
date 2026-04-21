import { computed } from 'vue'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import MoshpitWorkflowPicker from './MoshpitWorkflowPicker.vue'

// Mock the workflow options composable so tests control the option list
vi.mock('@/platform/moshpit/composables/useMoshpitWorkflowOptions', () => ({
  useMoshpitWorkflowOptions: vi.fn()
}))

import { useMoshpitWorkflowOptions } from '@/platform/moshpit/composables/useMoshpitWorkflowOptions'
const mockWorkflowOptions = vi.mocked(useMoshpitWorkflowOptions)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const SAMPLE_OPTIONS = [
  { fingerprint: 'fp-cfg', displayName: 'cfg_sweep', count: 3 },
  { fingerprint: 'fp-portrait', displayName: 'portrait', count: 12 }
]

function mountPicker() {
  return render(MoshpitWorkflowPicker, {
    global: { plugins: [createPinia(), i18n] }
  })
}

describe('MoshpitWorkflowPicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockWorkflowOptions.mockReturnValue({
      options: computed(() => SAMPLE_OPTIONS)
    })
  })

  it('renders placeholder when filterStore.workflow is null', () => {
    mountPicker()
    expect(
      screen.getByText(enMessages.moshpit.filters.workflowPickerPlaceholder)
    ).toBeInTheDocument()
  })

  it('renders the matching displayName (not raw fingerprint) when workflow is set', async () => {
    mountPicker()
    const filterStore = useMoshpitFilterStore()
    filterStore.setWorkflow('fp-cfg')

    await new Promise((r) => setTimeout(r, 0))

    // Should show 'cfg_sweep' (the displayName), NOT 'fp-cfg' (the raw fingerprint)
    expect(screen.getByText('cfg_sweep')).toBeInTheDocument()
    expect(screen.queryByText('fp-cfg')).not.toBeInTheDocument()
  })

  it('opens the combobox listbox when trigger is clicked', async () => {
    const user = userEvent.setup()
    mountPicker()

    const trigger = screen.getByTestId('moshpit-workflow-picker-trigger')
    await user.click(trigger)

    // After opening, ComboboxContent renders with role="listbox"
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
  })

  it('calls filterStore.setWorkflow with the fingerprint when an option is clicked', async () => {
    const user = userEvent.setup()
    mountPicker()
    const filterStore = useMoshpitFilterStore()

    const trigger = screen.getByTestId('moshpit-workflow-picker-trigger')
    await user.click(trigger)

    // Items have role="option" — find by accessible name matching the ICU text
    const option = await screen.findByRole('option', { name: /cfg_sweep/ })
    await user.click(option)

    expect(filterStore.workflow).toBe('fp-cfg')
  })

  it('clicking the "All workflows" entry clears filterStore.workflow', async () => {
    const user = userEvent.setup()
    mountPicker()
    const filterStore = useMoshpitFilterStore()
    filterStore.setWorkflow('fp-cfg')

    const trigger = screen.getByTestId('moshpit-workflow-picker-trigger')
    await user.click(trigger)

    const allEntry = await screen.findByTestId('moshpit-workflow-picker-all')
    await user.click(allEntry)

    expect(filterStore.workflow).toBeNull()
  })

  it('renders option labels via ICU plural key — singular and plural forms', async () => {
    const user = userEvent.setup()

    mockWorkflowOptions.mockReturnValue({
      options: computed(() => [
        { fingerprint: 'fp-a', displayName: 'cfg_sweep', count: 1 },
        { fingerprint: 'fp-b', displayName: 'portrait', count: 12 }
      ])
    })

    mountPicker()
    const trigger = screen.getByTestId('moshpit-workflow-picker-trigger')
    await user.click(trigger)

    // ICU singular (count=1): "cfg_sweep (1 asset)"
    expect(await screen.findByText('cfg_sweep (1 asset)')).toBeInTheDocument()
    // ICU plural (count=12): "portrait (12 assets)"
    expect(await screen.findByText('portrait (12 assets)')).toBeInTheDocument()
  })
})
