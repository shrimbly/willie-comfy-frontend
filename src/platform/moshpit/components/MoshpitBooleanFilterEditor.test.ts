import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import MoshpitBooleanFilterEditor from './MoshpitBooleanFilterEditor.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function mountEditor() {
  return render(MoshpitBooleanFilterEditor, {
    props: { param: 'favourite', modelValue: null },
    global: { plugins: [createPinia(), i18n] }
  })
}

describe('MoshpitBooleanFilterEditor', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders a checkbox with the i18n favourite label', () => {
    mountEditor()
    expect(
      screen.getByRole('checkbox')
    ).toBeInTheDocument()
    expect(
      screen.getByText(enMessages.moshpit.filters.editorFavouriteLabel)
    ).toBeInTheDocument()
  })

  it('emits boolean ChipValue with value=true on mount (default checked)', () => {
    const { emitted } = mountEditor()
    // The watcher fires immediately on mount
    const updates = emitted<unknown[]>('update:modelValue')
    expect(updates).toBeTruthy()
    const firstUpdate = updates![0][0]
    expect(firstUpdate).toMatchObject({ kind: 'boolean', value: true })
  })

  it('toggling the checkbox emits boolean ChipValue with value=false', async () => {
    const user = userEvent.setup()
    const { emitted } = mountEditor()

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    const updates = emitted<unknown[]>('update:modelValue')
    const lastUpdate = updates![updates!.length - 1][0]
    expect(lastUpdate).toMatchObject({ kind: 'boolean', value: false })
  })
})
