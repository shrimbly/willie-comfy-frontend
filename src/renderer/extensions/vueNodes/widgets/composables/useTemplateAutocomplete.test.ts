import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { useTemplateAutocomplete } from './useTemplateAutocomplete'
import type { TemplateSuggestion } from './templateSuggestions'

function suggestion(
  label: string,
  insertText = `@${label}`
): TemplateSuggestion {
  return {
    key: `test:${label}`,
    label,
    insertText,
    description: '',
    filterText: label.toLowerCase(),
    group: 'variable'
  }
}

const mockSuggestions: TemplateSuggestion[] = [
  suggestion('project'),
  suggestion('workflowTitle'),
  suggestion('groupTitle'),
  suggestion('width', '%width%'),
  suggestion('height', '%height%'),
  suggestion('KSampler.seed', '%KSampler.seed%')
]

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
    const suggestions = ref(mockSuggestions)
    const { handleInput, isOpen, filteredSuggestions } =
      useTemplateAutocomplete(inputValue, el, suggestions)

    handleInput()

    expect(isOpen.value).toBe(true)
    expect(filteredSuggestions.value.length).toBe(mockSuggestions.length)
  })

  it('filters suggestions by partial query', () => {
    const inputValue = ref('@pro')
    const el = ref(makeInputEl('@pro', 4))
    const suggestions = ref(mockSuggestions)
    const { handleInput, isOpen, filteredSuggestions } =
      useTemplateAutocomplete(inputValue, el, suggestions)

    handleInput()

    expect(isOpen.value).toBe(true)
    expect(filteredSuggestions.value.map((s) => s.label)).toEqual(['project'])
  })

  it('uses substring match across filterText', () => {
    const inputValue = ref('@seed')
    const el = ref(makeInputEl('@seed', 5))
    const suggestions = ref(mockSuggestions)
    const { handleInput, filteredSuggestions } = useTemplateAutocomplete(
      inputValue,
      el,
      suggestions
    )

    handleInput()

    expect(filteredSuggestions.value.map((s) => s.label)).toEqual([
      'KSampler.seed'
    ])
  })

  it('closes when no @ pattern is found', () => {
    const inputValue = ref('hello')
    const el = ref(makeInputEl('hello', 5))
    const suggestions = ref(mockSuggestions)
    const { handleInput, isOpen } = useTemplateAutocomplete(
      inputValue,
      el,
      suggestions
    )

    handleInput()

    expect(isOpen.value).toBe(false)
  })

  it('splices insertText for @ variables', async () => {
    const inputValue = ref('output/@pro')
    const el = ref(makeInputEl('output/@pro', 11))
    const suggestions = ref(mockSuggestions)
    const { handleInput, selectSuggestion, filteredSuggestions } =
      useTemplateAutocomplete(inputValue, el, suggestions)

    handleInput()
    selectSuggestion(filteredSuggestions.value[0])
    await nextTick()

    expect(inputValue.value).toBe('output/@project')
  })

  it('splices %width% when picking a runtime token', async () => {
    const inputValue = ref('out/@wid')
    const el = ref(makeInputEl('out/@wid', 8))
    const suggestions = ref(mockSuggestions)
    const { handleInput, selectSuggestion, filteredSuggestions } =
      useTemplateAutocomplete(inputValue, el, suggestions)

    handleInput()
    selectSuggestion(filteredSuggestions.value[0])
    await nextTick()

    expect(inputValue.value).toBe('out/%width%')
  })

  it('splices %Node.widget% when picking a node reference', async () => {
    const inputValue = ref('@ksampler')
    const el = ref(makeInputEl('@ksampler', 9))
    const suggestions = ref(mockSuggestions)
    const { handleInput, selectSuggestion, filteredSuggestions } =
      useTemplateAutocomplete(inputValue, el, suggestions)

    handleInput()
    selectSuggestion(filteredSuggestions.value[0])
    await nextTick()

    expect(inputValue.value).toBe('%KSampler.seed%')
  })

  it('closes after selection', async () => {
    const inputValue = ref('@pro')
    const el = ref(makeInputEl('@pro', 4))
    const suggestions = ref(mockSuggestions)
    const { handleInput, selectSuggestion, filteredSuggestions, isOpen } =
      useTemplateAutocomplete(inputValue, el, suggestions)

    handleInput()
    expect(isOpen.value).toBe(true)

    selectSuggestion(filteredSuggestions.value[0])
    await nextTick()

    expect(isOpen.value).toBe(false)
  })
})
