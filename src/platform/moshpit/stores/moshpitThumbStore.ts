import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useMoshpitThumbStore = defineStore('moshpitThumb', () => {
  const urlByHash = ref(new Map<string, string>())
  const size = computed(() => urlByHash.value.size)

  function getUrl(contentHash: string): string | undefined {
    return urlByHash.value.get(contentHash)
  }

  function has(contentHash: string): boolean {
    return urlByHash.value.has(contentHash)
  }

  function addThumb(contentHash: string, blob: Blob): string {
    const existing = urlByHash.value.get(contentHash)
    if (existing) URL.revokeObjectURL(existing)
    const url = URL.createObjectURL(blob)
    urlByHash.value.set(contentHash, url)
    return url
  }

  function reset(): void {
    urlByHash.value.forEach((url) => URL.revokeObjectURL(url))
    urlByHash.value.clear()
  }

  return { urlByHash, size, getUrl, has, addThumb, reset }
})
