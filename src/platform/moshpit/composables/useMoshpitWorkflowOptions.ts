import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import { useMoshpitAssetRegistry } from './useMoshpitAssetRegistry'
import { useMoshpitMetadataStore } from '../stores/moshpitMetadataStore'

export interface WorkflowOption {
  readonly fingerprint: string
  readonly displayName: string // Human-readable: workflowFilename when available, else 'unnamed-<shortFingerprint>'
  readonly count: number
}

function fingerprintToUnnamedLabel(fingerprint: string): string {
  // Truncate fingerprint for display — fingerprints can be long pipe-joined class_type sets.
  const short =
    fingerprint.length > 12 ? `${fingerprint.slice(0, 12)}\u2026` : fingerprint
  return `unnamed-${short}`
}

export function useMoshpitWorkflowOptions(): {
  readonly options: ComputedRef<readonly WorkflowOption[]>
} {
  const registry = useMoshpitAssetRegistry()
  const metaStore = useMoshpitMetadataStore()

  const options = computed<readonly WorkflowOption[]>(() => {
    // Track per-fingerprint count + a representative filename (first non-null wins,
    // stable via deterministic iteration of registry entries which are sorted)
    const counts = new Map<string, number>()
    const filenames = new Map<string, string | null>()

    for (const entry of registry.entries.value) {
      const params = metaStore.paramsByHash.get(entry.contentHash)
      if (!params || !params.workflowFingerprint) continue
      const fp = params.workflowFingerprint
      counts.set(fp, (counts.get(fp) ?? 0) + 1)
      if (!filenames.has(fp)) {
        filenames.set(fp, params.workflowFilename)
      } else if (
        filenames.get(fp) === null &&
        params.workflowFilename !== null
      ) {
        // Upgrade null → first non-null filename we encounter
        filenames.set(fp, params.workflowFilename)
      }
    }

    const out: WorkflowOption[] = []
    for (const [fingerprint, count] of counts) {
      const filename = filenames.get(fingerprint) ?? null
      const displayName =
        filename !== null && filename.length > 0
          ? filename
          : fingerprintToUnnamedLabel(fingerprint)
      out.push({ fingerprint, displayName, count })
    }

    out.sort(
      (a, b) =>
        b.count - a.count ||
        (a.displayName < b.displayName
          ? -1
          : a.displayName > b.displayName
            ? 1
            : 0)
    )

    return out
  })

  return { options }
}
