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
 * these inputs and produces world positions for the sprite layer (Plan 03-06).
 *
 * NOTE: This is an initial stub created in Plan 03-07 (Wave 2) to unblock UI
 * components. Plan 03-06 (Wave 4) extends this store with the full chip
 * management, sort axes, grid spacing, and useMoshpitFilteredAssets wiring.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { TimeRange } from '../services/filterTypes'

const DEFAULT_TIME_RANGE: TimeRange = { preset: 'all', from: null, to: null }

export const useMoshpitFilterStore = defineStore('moshpitFilter', () => {
  // The workflowFingerprint selected by the user — null until the user picks one.
  // Drives the FILTER-01 gate: canvas is empty until this is set.
  const workflow = ref<string | null>(null)
  const timeRange = ref<TimeRange>(DEFAULT_TIME_RANGE)

  // isGated is true once a workflow is selected — gates chip rail + sort section
  const isGated = computed(() => workflow.value !== null)

  function setWorkflow(value: string | null): void {
    workflow.value = value
  }

  function setTimeRange(value: TimeRange): void {
    timeRange.value = value
  }

  function reset(): void {
    workflow.value = null
    timeRange.value = DEFAULT_TIME_RANGE
  }

  return {
    workflow,
    timeRange,
    isGated,
    setWorkflow,
    setTimeRange,
    reset
  }
})
