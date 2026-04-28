import type { Ref } from 'vue'
import { computed, ref } from 'vue'

import type { TemplateSuggestion } from './templateSuggestions'

function findAtQuery(
  value: string,
  cursorPos: number
): { query: string; start: number } | null {
  const before = value.slice(0, cursorPos)
  const match = /@(\w*)$/.exec(before)
  if (!match) return null
  return { query: match[1], start: match.index }
}

export function useTemplateAutocomplete(
  inputValue: Ref<string>,
  inputEl: Ref<HTMLInputElement | null>,
  suggestions: Ref<TemplateSuggestion[]>
) {
  const isOpen = ref(false)
  const currentQuery = ref('')
  const atStart = ref(0)

  const filteredSuggestions = computed<TemplateSuggestion[]>(() => {
    const q = currentQuery.value.toLowerCase()
    if (!q) return suggestions.value
    return suggestions.value.filter((s) => s.filterText.includes(q))
  })

  function handleInput() {
    const el = inputEl.value
    if (!el) return

    const result = findAtQuery(el.value, el.selectionStart ?? 0)
    if (result) {
      currentQuery.value = result.query
      atStart.value = result.start
      isOpen.value = true
    } else {
      isOpen.value = false
    }
  }

  function selectSuggestion(suggestion: TemplateSuggestion) {
    const el = inputEl.value
    if (!el) return

    const before = inputValue.value.slice(0, atStart.value)
    const after = inputValue.value.slice(
      atStart.value + 1 + currentQuery.value.length
    )
    const replacement = suggestion.insertText
    inputValue.value = before + replacement + after
    isOpen.value = false

    const newCursor = before.length + replacement.length
    requestAnimationFrame(() => {
      el.setSelectionRange(newCursor, newCursor)
      el.focus()
    })
  }

  return {
    isOpen,
    filteredSuggestions,
    selectSuggestion,
    handleInput
  }
}
