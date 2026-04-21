import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import { useMoshpitCurationStore } from '../stores/moshpitCurationStore'
import { useMoshpitMetadataStore } from '../stores/moshpitMetadataStore'
import type { ParamKey } from '../services/filterTypes'

export interface ValueOption {
  readonly value: string
  readonly count: number
}

/**
 * Derives the unique set of values currently present in `paramsByHash` for a
 * given categorical ParamKey (model, sampler, scheduler, loras, tags), along
 * with per-value counts for the picker badge (UI-SPEC §Categorical editor).
 *
 * Accepts a reactive ParamKey source (ref, getter, or plain value) — uses
 * `toValue()` internally so the composable re-derives on changes.
 *
 * Returns options sorted by descending count then alpha, and resolution pairs
 * for the resolution editor.
 */
export function useMoshpitParamValueOptions(
  paramSource: MaybeRefOrGetter<ParamKey | null>
): {
  readonly options: ComputedRef<readonly ValueOption[]>
  readonly resolutionPairs: ComputedRef<readonly (readonly [number, number])[]>
} {
  const metaStore = useMoshpitMetadataStore()
  const curationStore = useMoshpitCurationStore()

  const options = computed<readonly ValueOption[]>(() => {
    const param = toValue(paramSource)
    if (!param) return []

    const counts = new Map<string, number>()
    for (const [hash, params] of metaStore.paramsByHash) {
      switch (param) {
        case 'model':
          if (params.model)
            counts.set(params.model, (counts.get(params.model) ?? 0) + 1)
          break
        case 'sampler':
          if (params.sampler)
            counts.set(params.sampler, (counts.get(params.sampler) ?? 0) + 1)
          break
        case 'scheduler':
          if (params.scheduler)
            counts.set(
              params.scheduler,
              (counts.get(params.scheduler) ?? 0) + 1
            )
          break
        case 'loras':
          for (const l of params.loras)
            counts.set(l.name, (counts.get(l.name) ?? 0) + 1)
          break
        case 'tags': {
          const cur = curationStore.get(hash)
          if (cur) {
            for (const tag of cur.tags)
              counts.set(tag, (counts.get(tag) ?? 0) + 1)
          }
          break
        }
        case 'saveNode': {
          const identity = params.saveNodeIdentity
          if (identity) counts.set(identity, (counts.get(identity) ?? 0) + 1)
          break
        }
        default:
          // numeric/text/boolean/resolution/timestamp params don't use this path
          break
      }
    }

    const out: ValueOption[] = Array.from(counts, ([value, count]) => ({
      value,
      count
    }))
    out.sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1))
    return out
  })

  const resolutionPairs = computed<readonly (readonly [number, number])[]>(
    () => {
      const param = toValue(paramSource)
      if (param !== 'resolution') return []

      const seen = new Map<string, readonly [number, number]>()
      for (const [, params] of metaStore.paramsByHash) {
        if (params.width !== undefined && params.height !== undefined) {
          const key = `${params.width}x${params.height}`
          if (!seen.has(key)) seen.set(key, [params.width, params.height])
        }
      }
      return [...seen.values()]
    }
  )

  return { options, resolutionPairs }
}
