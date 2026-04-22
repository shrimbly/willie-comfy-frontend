import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import type { FilterChip } from '../services/filterTypes'
import { useMoshpitFilterStore } from './moshpitFilterStore'

describe('moshpitFilterStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  describe('initial state', () => {
    it('workflow is null', () => {
      const store = useMoshpitFilterStore()
      expect(store.workflow).toBeNull()
    })

    it('timeRange preset is "all"', () => {
      const store = useMoshpitFilterStore()
      expect(store.timeRange.preset).toBe('all')
    })

    it('chips is empty', () => {
      const store = useMoshpitFilterStore()
      expect(store.chips).toHaveLength(0)
    })

    it('activeGroupings is empty', () => {
      const store = useMoshpitFilterStore()
      expect(store.activeGroupings).toHaveLength(0)
    })

    it('withinClusterSort defaults to newestFirst', () => {
      const store = useMoshpitFilterStore()
      expect(store.withinClusterSort).toBe('newestFirst')
    })

    it('isAdvancedOpen is false', () => {
      const store = useMoshpitFilterStore()
      expect(store.isAdvancedOpen).toBe(false)
    })

    it('showHidden is false', () => {
      const store = useMoshpitFilterStore()
      expect(store.showHidden).toBe(false)
    })

    it('isGated is false when workflow is null', () => {
      const store = useMoshpitFilterStore()
      expect(store.isGated).toBe(false)
    })
  })

  describe('setWorkflow (FILTER-01)', () => {
    it('sets workflow to fingerprint value', () => {
      const store = useMoshpitFilterStore()
      store.setWorkflow('abc123')
      expect(store.workflow).toBe('abc123')
    })

    it('isGated becomes true once workflow is set', () => {
      const store = useMoshpitFilterStore()
      store.setWorkflow('abc123')
      expect(store.isGated).toBe(true)
    })

    it('setWorkflow(null) re-closes the gate and isGated flips back to false', () => {
      const store = useMoshpitFilterStore()
      store.setWorkflow('abc123')
      expect(store.isGated).toBe(true)
      store.setWorkflow(null)
      expect(store.isGated).toBe(false)
      expect(store.workflow).toBeNull()
    })

    it('isGated becomes true when a non-all time range is set without a workflow (OR semantics)', () => {
      const store = useMoshpitFilterStore()
      store.setTimeRange({ preset: 'today', from: null, to: null })
      expect(store.workflow).toBeNull()
      expect(store.isGated).toBe(true)
    })

    it('isGated flips back to false when time range is reset to all and no workflow is set', () => {
      const store = useMoshpitFilterStore()
      store.setTimeRange({ preset: 'thisWeek', from: null, to: null })
      expect(store.isGated).toBe(true)
      store.setTimeRange({ preset: 'all', from: null, to: null })
      expect(store.isGated).toBe(false)
    })
  })

  describe('addChip', () => {
    it('appends a chip to chips[]', () => {
      const store = useMoshpitFilterStore()
      const chip: FilterChip = {
        id: 'chip-1',
        param: 'sampler',
        value: { kind: 'categorical', values: ['euler'] }
      }
      store.addChip(chip)
      expect(store.chips).toHaveLength(1)
      expect(store.chips[0].id).toBe('chip-1')
    })

    it('rejects duplicate chip IDs (does not add a second chip with same id)', () => {
      const store = useMoshpitFilterStore()
      const chip: FilterChip = {
        id: 'chip-1',
        param: 'cfg',
        value: { kind: 'numeric', min: 5, max: 10, exact: null }
      }
      store.addChip(chip)
      store.addChip(chip)
      expect(store.chips).toHaveLength(1)
    })

    it('merges values OR-combined when adding a chip for a param that already has a chip (D-12)', () => {
      const store = useMoshpitFilterStore()
      store.addChip({
        id: 'chip-1',
        param: 'sampler',
        value: { kind: 'categorical', values: ['euler'] }
      })
      store.addChip({
        id: 'chip-2',
        param: 'sampler',
        value: { kind: 'categorical', values: ['dpmpp_2m'] }
      })
      // D-12: merged into one chip with OR semantics
      expect(store.chips).toHaveLength(1)
      const chip = store.chips[0]
      expect(chip.value.kind).toBe('categorical')
      if (chip.value.kind === 'categorical') {
        expect(chip.value.values).toContain('euler')
        expect(chip.value.values).toContain('dpmpp_2m')
      }
    })

    it('does NOT merge chips with different param', () => {
      const store = useMoshpitFilterStore()
      store.addChip({
        id: 'chip-1',
        param: 'sampler',
        value: { kind: 'categorical', values: ['euler'] }
      })
      store.addChip({
        id: 'chip-2',
        param: 'model',
        value: { kind: 'categorical', values: ['v1-5.safetensors'] }
      })
      expect(store.chips).toHaveLength(2)
    })

    it('does NOT merge chips with incompatible ChipValue.kind (e.g. numeric vs categorical)', () => {
      const store = useMoshpitFilterStore()
      store.addChip({
        id: 'chip-1',
        param: 'cfg',
        value: { kind: 'categorical', values: ['7'] }
      })
      // cfg already has a categorical chip; numeric chip with same param should NOT merge
      // because kinds differ (categorical vs numeric)
      store.addChip({
        id: 'chip-2',
        param: 'cfg',
        value: { kind: 'numeric', min: 6, max: 8, exact: null }
      })
      // Incompatible kinds: falls back to appending new chip
      expect(store.chips).toHaveLength(2)
    })
  })

  describe('removeChip (FILTER-10)', () => {
    it('removes chip matching id', () => {
      const store = useMoshpitFilterStore()
      store.addChip({
        id: 'chip-1',
        param: 'sampler',
        value: { kind: 'categorical', values: ['euler'] }
      })
      store.removeChip('chip-1')
      expect(store.chips).toHaveLength(0)
    })

    it('does nothing when id is not found', () => {
      const store = useMoshpitFilterStore()
      store.addChip({
        id: 'chip-1',
        param: 'sampler',
        value: { kind: 'categorical', values: ['euler'] }
      })
      store.removeChip('nonexistent')
      expect(store.chips).toHaveLength(1)
    })
  })

  describe('updateChip', () => {
    it('replaces chip.value for matching id', () => {
      const store = useMoshpitFilterStore()
      store.addChip({
        id: 'chip-1',
        param: 'cfg',
        value: { kind: 'numeric', min: 5, max: 10, exact: null }
      })
      store.updateChip('chip-1', {
        kind: 'numeric',
        min: 1,
        max: 3,
        exact: null
      })
      const chip = store.chips.find((c) => c.id === 'chip-1')
      expect(chip?.value).toEqual({
        kind: 'numeric',
        min: 1,
        max: 3,
        exact: null
      })
    })

    it('preserves chip.id and chip.param', () => {
      const store = useMoshpitFilterStore()
      store.addChip({
        id: 'chip-1',
        param: 'sampler',
        value: { kind: 'categorical', values: ['euler'] }
      })
      store.updateChip('chip-1', { kind: 'categorical', values: ['dpmpp_2m'] })
      const chip = store.chips.find((c) => c.id === 'chip-1')
      expect(chip?.id).toBe('chip-1')
      expect(chip?.param).toBe('sampler')
    })
  })

  describe('toggleGrouping (GROUP-01, D-19)', () => {
    it('adds axis when not present', () => {
      const store = useMoshpitFilterStore()
      store.toggleGrouping('workflow')
      expect(store.activeGroupings).toEqual(['workflow'])
    })

    it('removes axis when already present', () => {
      const store = useMoshpitFilterStore()
      store.toggleGrouping('workflow')
      store.toggleGrouping('workflow')
      expect(store.activeGroupings).toHaveLength(0)
    })

    it('preserves insertion order when toggling multiple axes', () => {
      const store = useMoshpitFilterStore()
      store.toggleGrouping('workflow')
      store.toggleGrouping('prompt')
      store.toggleGrouping('model')
      expect(store.activeGroupings).toEqual(['workflow', 'prompt', 'model'])
    })

    it('removes only the specified axis from the middle of the ordered list', () => {
      const store = useMoshpitFilterStore()
      store.toggleGrouping('workflow')
      store.toggleGrouping('prompt')
      store.toggleGrouping('model')
      store.toggleGrouping('prompt')
      expect(store.activeGroupings).toEqual(['workflow', 'model'])
    })
  })

  describe('setWithinClusterSort (CSORT-01)', () => {
    it('updates the within-cluster sort mode', () => {
      const store = useMoshpitFilterStore()
      store.setWithinClusterSort('oldestFirst')
      expect(store.withinClusterSort).toBe('oldestFirst')
      store.setWithinClusterSort('alphabetical')
      expect(store.withinClusterSort).toBe('alphabetical')
    })
  })

  describe('toggleAdvanced / setAdvancedOpen (D-14)', () => {
    it('toggleAdvanced flips isAdvancedOpen', () => {
      const store = useMoshpitFilterStore()
      store.toggleAdvanced()
      expect(store.isAdvancedOpen).toBe(true)
      store.toggleAdvanced()
      expect(store.isAdvancedOpen).toBe(false)
    })

    it('setAdvancedOpen assigns the boolean directly (Reka controlled path)', () => {
      const store = useMoshpitFilterStore()
      store.setAdvancedOpen(true)
      expect(store.isAdvancedOpen).toBe(true)
      store.setAdvancedOpen(false)
      expect(store.isAdvancedOpen).toBe(false)
    })
  })

  describe('saveNode chip (D-14 tier-agnostic add)', () => {
    it('adding a chip with param: "saveNode" lands in chips[] unchanged by tier routing', () => {
      const store = useMoshpitFilterStore()
      store.addChip({
        id: 'chip-save-node',
        param: 'saveNode',
        value: { kind: 'categorical', values: ['Final Output'] }
      })
      expect(store.chips).toHaveLength(1)
      expect(store.chips[0].param).toBe('saveNode')
    })
  })

  describe('setGridSpacing (SORT-04)', () => {
    it('clamps to range [200, 1200]', () => {
      const store = useMoshpitFilterStore()
      store.setGridSpacing(50)
      expect(store.gridSpacing).toBe(200)
      store.setGridSpacing(2000)
      expect(store.gridSpacing).toBe(1200)
    })

    it('accepts a value within range', () => {
      const store = useMoshpitFilterStore()
      store.setGridSpacing(600)
      expect(store.gridSpacing).toBe(600)
    })
  })

  describe('setShowHidden (FILTER-11)', () => {
    it('flips showHidden flag', () => {
      const store = useMoshpitFilterStore()
      store.setShowHidden(true)
      expect(store.showHidden).toBe(true)
      store.setShowHidden(false)
      expect(store.showHidden).toBe(false)
    })
  })

  describe('reset', () => {
    it('restores all fields to initial state', () => {
      const store = useMoshpitFilterStore()
      store.setWorkflow('fingerprint-abc')
      store.setTimeRange({ preset: 'today', from: null, to: null })
      store.addChip({
        id: 'chip-1',
        param: 'sampler',
        value: { kind: 'categorical', values: ['euler'] }
      })
      store.toggleGrouping('workflow')
      store.toggleGrouping('prompt')
      store.setWithinClusterSort('alphabetical')
      store.setAdvancedOpen(true)
      store.setGridSpacing(800)
      store.setShowHidden(true)
      store.reset()
      expect(store.workflow).toBeNull()
      expect(store.timeRange.preset).toBe('all')
      expect(store.chips).toHaveLength(0)
      expect(store.activeGroupings).toHaveLength(0)
      expect(store.withinClusterSort).toBe('newestFirst')
      expect(store.isAdvancedOpen).toBe(false)
      expect(store.showHidden).toBe(false)
      expect(store.isGated).toBe(false)
    })
  })
})
