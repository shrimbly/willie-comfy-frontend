/**
 * Lightbox Pinia store — ephemeral detail-view state.
 *
 * Opens on Enter-with-selection or double-click of a sprite, shows the
 * asset(s) fullscreen with a metadata side panel, and navigates with
 * ArrowLeft / ArrowRight when multiple hashes are open.
 *
 * State dies on close. No IndexedDB coupling.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useMoshpitLightboxStore = defineStore('moshpitLightbox', () => {
  const hashes = ref<readonly string[]>([])
  const index = ref(0)
  const isOpen = ref(false)

  const currentHash = computed<string | null>(() =>
    isOpen.value ? (hashes.value[index.value] ?? null) : null
  )
  const hasMultiple = computed(() => hashes.value.length > 1)

  function open(next: readonly string[], startIndex = 0): void {
    if (next.length === 0) return
    hashes.value = [...next]
    index.value = Math.max(0, Math.min(startIndex, next.length - 1))
    isOpen.value = true
  }

  function close(): void {
    if (!isOpen.value) return
    isOpen.value = false
    hashes.value = []
    index.value = 0
  }

  function next(): void {
    if (hashes.value.length < 2) return
    index.value = (index.value + 1) % hashes.value.length
  }

  function prev(): void {
    if (hashes.value.length < 2) return
    index.value = (index.value - 1 + hashes.value.length) % hashes.value.length
  }

  return {
    hashes,
    index,
    isOpen,
    currentHash,
    hasMultiple,
    open,
    close,
    next,
    prev
  }
})
