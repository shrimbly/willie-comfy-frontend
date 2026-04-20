import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useMoshpitSelectionStore = defineStore('moshpitSelection', () => {
  const selectedIds = ref<Set<string>>(new Set())

  const selected = computed(() => [...selectedIds.value])
  const size = computed(() => selectedIds.value.size)

  function isSelected(id: string) {
    return selectedIds.value.has(id)
  }

  function add(id: string) {
    const next = new Set(selectedIds.value)
    next.add(id)
    selectedIds.value = next
  }

  function addMany(ids: readonly string[]) {
    const next = new Set(selectedIds.value)
    for (const id of ids) next.add(id)
    selectedIds.value = next
  }

  function remove(id: string) {
    if (!selectedIds.value.has(id)) return
    const next = new Set(selectedIds.value)
    next.delete(id)
    selectedIds.value = next
  }

  function toggle(id: string) {
    if (selectedIds.value.has(id)) remove(id)
    else add(id)
  }

  function setSelection(ids: readonly string[]) {
    selectedIds.value = new Set(ids)
  }

  function selectAll(allIds: readonly string[]) {
    selectedIds.value = new Set(allIds)
  }

  function clear() {
    if (selectedIds.value.size === 0) return
    selectedIds.value = new Set()
  }

  return {
    selected,
    size,
    isSelected,
    add,
    addMany,
    remove,
    toggle,
    setSelection,
    selectAll,
    clear
  }
})
