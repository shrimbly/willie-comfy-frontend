import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: (key: string) => {
      if (key === 'Comfy.Filename.CustomVariables') return []
      return undefined
    }
  }))
}))

import { useTemplateAutocomplete } from './useTemplateAutocomplete'

function makeInputEl(value: string, selectionStart: number) {
  return {
    value,
    selectionStart,
    focus: () => {},
    setSelectionRange: () => {}
  } as unknown as HTMLInputElement
}

describe('useTemplateAutocomplete', () => {
  it('opens when @ is typed', () => {
    const inputValue = ref('@')
    const el = ref(makeInputEl('@', 1))
    const { handleInput, isOpen, filteredSuggestions } =
      useTemplateAutocomplete(inputValue, el)

    handleInput()

    expect(isOpen.value).toBe(true)
    expect(filteredSuggestions.value.length).toBe(4)
  })

  it('filters suggestions by partial query', () => {
    const inputValue = ref('@pro')
    const el = ref(makeInputEl('@pro', 4))
    const { handleInput, isOpen, filteredSuggestions } =
      useTemplateAutocomplete(inputValue, el)

    handleInput()

    expect(isOpen.value).toBe(true)
    expect(filteredSuggestions.value.length).toBe(1)
    expect(filteredSuggestions.value[0].name).toBe('project')
  })

  it('closes when no @ pattern is found', () => {
    const inputValue = ref('hello')
    const el = ref(makeInputEl('hello', 5))
    const { handleInput, isOpen } = useTemplateAutocomplete(inputValue, el)

    handleInput()

    expect(isOpen.value).toBe(false)
  })

  it('selects a suggestion and splices into text', async () => {
    const inputValue = ref('output/@pro')
    const el = ref(makeInputEl('output/@pro', 11))
    const { handleInput, selectSuggestion, filteredSuggestions } =
      useTemplateAutocomplete(inputValue, el)

    handleInput()
    selectSuggestion(filteredSuggestions.value[0])
    await nextTick()

    expect(inputValue.value).toBe('output/@project')
  })

  it('navigates suggestions with ArrowDown', () => {
    const inputValue = ref('@')
    const el = ref(makeInputEl('@', 1))
    const { handleInput, handleKeydown, highlightIndex } =
      useTemplateAutocomplete(inputValue, el)

    handleInput()

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
    Object.defineProperty(event, 'preventDefault', { value: () => {} })
    handleKeydown(event)

    expect(highlightIndex.value).toBe(1)
  })

  it('wraps around on ArrowUp from first item', () => {
    const inputValue = ref('@')
    const el = ref(makeInputEl('@', 1))
    const { handleInput, handleKeydown, highlightIndex } =
      useTemplateAutocomplete(inputValue, el)

    handleInput()

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
    Object.defineProperty(event, 'preventDefault', { value: () => {} })
    handleKeydown(event)

    expect(highlightIndex.value).toBe(3)
  })

  it('closes on Escape', () => {
    const inputValue = ref('@')
    const el = ref(makeInputEl('@', 1))
    const { handleInput, handleKeydown, isOpen } = useTemplateAutocomplete(
      inputValue,
      el
    )

    handleInput()
    expect(isOpen.value).toBe(true)

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    Object.defineProperty(event, 'preventDefault', { value: () => {} })
    handleKeydown(event)

    expect(isOpen.value).toBe(false)
  })
})
