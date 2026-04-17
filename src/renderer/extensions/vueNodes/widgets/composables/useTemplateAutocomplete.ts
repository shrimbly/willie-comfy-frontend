import type { Ref } from 'vue'
import { computed, ref } from 'vue'

import type { TemplateVariable } from '@/utils/templateVariableResolver'
import { getTemplateVariables } from '@/utils/templateVariableResolver'

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
  inputEl: Ref<HTMLInputElement | null>
) {
  const isOpen = ref(false)
  const highlightIndex = ref(0)
  const currentQuery = ref('')
  const atStart = ref(0)

  const filteredSuggestions = computed<TemplateVariable[]>(() => {
    const allVars = getTemplateVariables()
    if (!currentQuery.value && isOpen.value) return allVars
    const q = currentQuery.value.toLowerCase()
    return allVars.filter((v) => v.name.toLowerCase().startsWith(q))
  })

  function handleInput() {
    const el = inputEl.value
    if (!el) return

    const result = findAtQuery(el.value, el.selectionStart ?? 0)
    if (result) {
      currentQuery.value = result.query
      atStart.value = result.start
      isOpen.value = true
      highlightIndex.value = 0
    } else {
      isOpen.value = false
    }
  }

  function selectSuggestion(variable: TemplateVariable) {
    const el = inputEl.value
    if (!el) return

    const before = inputValue.value.slice(0, atStart.value)
    const after = inputValue.value.slice(
      atStart.value + 1 + currentQuery.value.length
    )
    const replacement = `@${variable.name}`
    inputValue.value = before + replacement + after
    isOpen.value = false

    const newCursor = before.length + replacement.length
    requestAnimationFrame(() => {
      el.setSelectionRange(newCursor, newCursor)
      el.focus()
    })
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen.value || filteredSuggestions.value.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        highlightIndex.value =
          (highlightIndex.value + 1) % filteredSuggestions.value.length
        break
      case 'ArrowUp':
        e.preventDefault()
        highlightIndex.value =
          (highlightIndex.value - 1 + filteredSuggestions.value.length) %
          filteredSuggestions.value.length
        break
      case 'Enter':
        e.preventDefault()
        selectSuggestion(filteredSuggestions.value[highlightIndex.value])
        break
      case 'Escape':
        e.preventDefault()
        isOpen.value = false
        break
    }
  }

  return {
    isOpen,
    filteredSuggestions,
    highlightIndex,
    selectSuggestion,
    handleInput,
    handleKeydown
  }
}
