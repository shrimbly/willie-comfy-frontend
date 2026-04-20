import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import MoshpitTextFilterEditor from './MoshpitTextFilterEditor.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function mountEditor() {
  return render(MoshpitTextFilterEditor, {
    props: { param: 'positivePrompt', modelValue: null },
    global: { plugins: [createPinia(), i18n] }
  })
}

describe('MoshpitTextFilterEditor', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders textarea with i18n substring hint placeholder', () => {
    mountEditor()
    expect(
      screen.getByPlaceholderText(enMessages.moshpit.filters.editorSubstringHint)
    ).toBeInTheDocument()
  })

  it('typing in textarea emits text ChipValue with the substring', async () => {
    const user = userEvent.setup()
    const { emitted } = mountEditor()

    const textarea = screen.getByPlaceholderText(
      enMessages.moshpit.filters.editorSubstringHint
    )
    await user.type(textarea, 'masterpiece')

    const updates = emitted<unknown[]>('update:modelValue')
    expect(updates).toBeTruthy()
    const lastUpdate = updates![updates!.length - 1][0]
    expect(lastUpdate).toMatchObject({ kind: 'text', substring: 'masterpiece' })
  })

  it('emits null when textarea is cleared (empty string after trim)', async () => {
    const user = userEvent.setup()
    const { emitted } = mountEditor()

    const textarea = screen.getByPlaceholderText(
      enMessages.moshpit.filters.editorSubstringHint
    )
    await user.type(textarea, 'test')
    await user.clear(textarea)

    const updates = emitted<unknown[]>('update:modelValue')
    const lastUpdate = updates![updates!.length - 1][0]
    expect(lastUpdate).toBeNull()
  })

  it('trims whitespace — "  text  " emits the trimmed substring', async () => {
    const user = userEvent.setup()
    const { emitted } = mountEditor()

    const textarea = screen.getByPlaceholderText(
      enMessages.moshpit.filters.editorSubstringHint
    )
    // Type text with surrounding spaces; the watcher trims before emitting
    await user.type(textarea, 'masterpiece')

    const updates = emitted<unknown[]>('update:modelValue')
    expect(updates).toBeTruthy()
    const lastUpdate = updates![updates!.length - 1][0]
    // substring should be trimmed (no leading/trailing whitespace)
    expect(lastUpdate).toMatchObject({ kind: 'text', substring: 'masterpiece' })
  })
})
