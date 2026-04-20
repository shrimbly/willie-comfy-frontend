/**
 * Moshpit filter/sort UI state (Phase 3). Single source of truth for:
 *   - The initial workflow + time-range gate (FILTER-01)
 *   - Active filter chips with OR-within / AND-across semantics (FILTER-10, D-12)
 *   - X/Y sort axes (SORT-01, SORT-02)
 *   - User-configurable grid spacing (SORT-04)
 *   - Show-hidden toggle (FILTER-11)
 *
 * Filter/sort math runs in pure functions (filterMath.ts, sortMath.ts) — this
 * store holds only the inputs. The useMoshpitFilteredAssets composable reads
 * this store and calls the pure functions once per reactive change.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  ChipValue,
  FilterChip,
  ParamKey,
  TimeRange
} from '../services/filterTypes'
import { DEFAULT_CELL_SIZE } from '../composables/useMoshpitSpriteLayer'

export const GRID_SPACING_MIN = 200
export const GRID_SPACING_MAX = 1200

const INITIAL_TIME_RANGE: TimeRange = Object.freeze({
  preset: 'all',
  from: null,
  to: null
})

function clampGridSpacing(px: number): number {
  return Math.max(GRID_SPACING_MIN, Math.min(GRID_SPACING_MAX, px))
}

/**
 * D-12: OR-merge within chip for same-param categorical/resolution chips.
 * Returns null when merge is not possible (incompatible kinds → caller appends).
 */
function mergeChipValues(
  existing: ChipValue,
  incoming: ChipValue
): ChipValue | null {
  if (existing.kind !== incoming.kind) return null
  switch (existing.kind) {
    case 'categorical': {
      const incomingCat = incoming as Extract<ChipValue, { kind: 'categorical' }>
      const merged = Array.from(new Set([...existing.values, ...incomingCat.values]))
      return { kind: 'categorical', values: merged }
    }
    case 'resolution': {
      const incomingRes = incoming as Extract<ChipValue, { kind: 'resolution' }>
      const seen = new Set<string>()
      const merged: [number, number][] = []
      for (const p of [...existing.pairs, ...incomingRes.pairs]) {
        const key = `${p[0]}x${p[1]}`
        if (!seen.has(key)) {
          seen.add(key)
          merged.push([p[0], p[1]])
        }
      }
      return { kind: 'resolution', pairs: merged }
    }
    case 'numeric':
    case 'text':
    case 'boolean':
      // Replace-not-merge for scalar chip kinds
      return null
  }
}

export const useMoshpitFilterStore = defineStore('moshpitFilter', () => {
  const workflow = ref<string | null>(null)
  const timeRange = ref<TimeRange>({ ...INITIAL_TIME_RANGE })
  const chips = ref<FilterChip[]>([])
  const sortX = ref<ParamKey | null>(null)
  const sortY = ref<ParamKey | null>(null)
  const gridSpacing = ref(DEFAULT_CELL_SIZE)
  const showHidden = ref(false)

  const isGated = computed(() => workflow.value !== null)

  function setWorkflow(value: string | null): void {
    workflow.value = value
  }

  function setTimeRange(value: TimeRange): void {
    timeRange.value = value
  }

  function addChip(chip: FilterChip): void {
    // Reject exact ID duplicates
    if (chips.value.some((c) => c.id === chip.id)) return

    // Try OR-merge with existing chip for same param
    const existingIdx = chips.value.findIndex((c) => c.param === chip.param)
    if (existingIdx >= 0) {
      const existing = chips.value[existingIdx]
      const merged = mergeChipValues(existing.value, chip.value)
      if (merged !== null) {
        chips.value = chips.value.map((c, i) =>
          i === existingIdx ? { ...c, value: merged } : c
        )
        return
      }
    }

    chips.value = [...chips.value, chip]
  }

  function removeChip(id: string): void {
    chips.value = chips.value.filter((c) => c.id !== id)
  }

  function updateChip(id: string, value: ChipValue): void {
    chips.value = chips.value.map((c) => (c.id === id ? { ...c, value } : c))
  }

  function setSortX(key: ParamKey | null): void {
    sortX.value = key
  }

  function setSortY(key: ParamKey | null): void {
    sortY.value = key
  }

  function setGridSpacing(px: number): void {
    gridSpacing.value = clampGridSpacing(px)
  }

  function setShowHidden(value: boolean): void {
    showHidden.value = value
  }

  function reset(): void {
    workflow.value = null
    timeRange.value = { ...INITIAL_TIME_RANGE }
    chips.value = []
    sortX.value = null
    sortY.value = null
    gridSpacing.value = DEFAULT_CELL_SIZE
    showHidden.value = false
  }

  return {
    workflow,
    timeRange,
    chips,
    sortX,
    sortY,
    gridSpacing,
    showHidden,
    isGated,
    setWorkflow,
    setTimeRange,
    addChip,
    removeChip,
    updateChip,
    setSortX,
    setSortY,
    setGridSpacing,
    setShowHidden,
    reset
  }
})
