import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import MoshpitNumericFilterEditor from './MoshpitNumericFilterEditor.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function mountEditor() {
  return render(MoshpitNumericFilterEditor, {
    props: { param: 'cfg' },
    global: { plugins: [createPinia(), i18n] }
  })
}

describe('MoshpitNumericFilterEditor', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders an exact-value toggle checkbox with i18n label', () => {
    mountEditor()
    expect(
      screen.getByRole('checkbox', {
        name: enMessages.moshpit.filters.editorExact
      })
    ).toBeInTheDocument()
  })

  it('shows min/max range inputs when exact toggle is unchecked (default)', () => {
    mountEditor()
    expect(
      screen.getByPlaceholderText(enMessages.moshpit.filters.editorMin)
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(enMessages.moshpit.filters.editorMax)
    ).toBeInTheDocument()
  })

  it('hides range inputs and shows single exact input when exact toggle is checked', async () => {
    const user = userEvent.setup()
    mountEditor()

    const toggle = screen.getByRole('checkbox', {
      name: enMessages.moshpit.filters.editorExact
    })
    await user.click(toggle)

    // Range inputs gone, single exact input visible
    expect(
      screen.queryByPlaceholderText(enMessages.moshpit.filters.editorMin)
    ).not.toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(enMessages.moshpit.filters.editorExact)
    ).toBeInTheDocument()
  })

  it('emits numeric range ChipValue when min and max are filled', async () => {
    const user = userEvent.setup()
    const { emitted } = render(MoshpitNumericFilterEditor, {
      props: { param: 'cfg', modelValue: null },
      global: { plugins: [createPinia(), i18n] }
    })

    const minInput = screen.getByPlaceholderText(
      enMessages.moshpit.filters.editorMin
    )
    await user.type(minInput, '6')

    // Should emit update:modelValue with numeric range
    const updates = emitted<unknown[]>('update:modelValue')
    expect(updates).toBeTruthy()
    const lastUpdate = updates![updates!.length - 1][0]
    expect(lastUpdate).toMatchObject({ kind: 'numeric', min: 6 })
  })

  it('emits numeric exact ChipValue when exact toggle is on and value filled', async () => {
    const user = userEvent.setup()
    const { emitted } = render(MoshpitNumericFilterEditor, {
      props: { param: 'steps', modelValue: null },
      global: { plugins: [createPinia(), i18n] }
    })

    const toggle = screen.getByRole('checkbox', {
      name: enMessages.moshpit.filters.editorExact
    })
    await user.click(toggle)

    const exactInput = screen.getByPlaceholderText(
      enMessages.moshpit.filters.editorExact
    )
    await user.type(exactInput, '20')

    const updates = emitted<unknown[]>('update:modelValue')
    const lastUpdate = updates![updates!.length - 1][0]
    expect(lastUpdate).toMatchObject({
      kind: 'numeric',
      exact: 20,
      min: null,
      max: null
    })
  })

  it('emits null when both min/max are empty', async () => {
    const user = userEvent.setup()
    const { emitted } = render(MoshpitNumericFilterEditor, {
      props: { param: 'cfg', modelValue: null },
      global: { plugins: [createPinia(), i18n] }
    })

    // Type then clear min
    const minInput = screen.getByPlaceholderText(
      enMessages.moshpit.filters.editorMin
    )
    await user.type(minInput, '6')
    await user.clear(minInput)

    const updates = emitted<unknown[]>('update:modelValue')
    const lastUpdate = updates![updates!.length - 1][0]
    expect(lastUpdate).toBeNull()
  })
})
