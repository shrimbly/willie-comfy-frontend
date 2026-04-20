import { defineStore } from 'pinia'
import { ref } from 'vue'

import type {
  AssetMetaRecord,
  CurationRecord
} from '@/platform/moshpit/services/thumbRepository.types'

/**
 * Phase 2 scaffold for curation state. Phase 5 will add mutation actions
 * (favourite, tag, hide, folder) that also write through to IDB. Phase 2
 * only populates the reactive layer after a thumb lands.
 */
export const useMoshpitCurationStore = defineStore('moshpitCuration', () => {
  const curationByHash = ref(new Map<string, CurationRecord>())

  function load(record: AssetMetaRecord): void {
    curationByHash.value.set(record.contentHash, record.curation)
  }

  function get(contentHash: string): CurationRecord | undefined {
    return curationByHash.value.get(contentHash)
  }

  function reset(): void {
    curationByHash.value.clear()
  }

  return { load, get, reset }
})
