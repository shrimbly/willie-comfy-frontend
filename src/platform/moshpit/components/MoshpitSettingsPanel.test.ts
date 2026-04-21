import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MoshpitSettingsPanel from './MoshpitSettingsPanel.vue'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import { useMoshpitMetadataStore } from '@/platform/moshpit/stores/moshpitMetadataStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      moshpit: {
        sidebar: { settings: 'Settings' },
        filters: {
          sectionLabel: 'Filter',
          workflowPickerLabel: 'Select workflow',
          workflowPickerPlaceholder: 'Select a workflow…',
          workflowPickerSearch: 'Search workflows…',
          workflowOptionCount:
            '{name} ({count} asset) | {name} ({count} assets)',
          timeRangeLabel: 'Time range',
          timeRangeToday: 'Today',
          timeRangeThisWeek: 'This week',
          timeRangeThisMonth: 'This month',
          timeRangeAllTime: 'All time',
          timeRangeCustom: 'Custom…',
          timeRangeFrom: 'From',
          timeRangeTo: 'To',
          addFilter: 'Add filter',
          searchParams: 'Search parameters…',
          removeChip: 'Remove {param} filter',
          chipCount: '{count} filter active | {count} filters active',
          paramModel: 'Model',
          paramLoras: 'LoRA',
          paramCfg: 'CFG',
          paramSteps: 'Steps',
          paramSampler: 'Sampler',
          paramScheduler: 'Scheduler',
          paramSeed: 'Seed',
          paramPrompt: 'Prompt',
          paramNegativePrompt: 'Negative prompt',
          paramResolution: 'Resolution',
          paramGenerationTime: 'Generation time',
          paramTags: 'Tags',
          paramFavourite: 'Favourite',
          paramWidth: 'Width',
          paramHeight: 'Height',
          editorApply: 'Apply filter',
          editorBack: 'Back',
          editorMin: 'Min',
          editorMax: 'Max',
          editorExact: 'Exact value',
          editorSubstringHint: 'Substring match, case-insensitive',
          editorSearchValues: 'Search values…',
          editorFavouriteLabel: 'Only favourited assets',
          emptyStateHeading: 'Pick a workflow to start',
          emptyStateBody:
            'Select a workflow and time range in the Settings panel to populate the canvas.'
        },
        sort: {
          sectionLabel: 'Sort',
          xAxisLabel: 'Sort X',
          yAxisLabel: 'Sort Y',
          xAxisPlaceholder: 'None',
          yAxisPlaceholder: 'None',
          clearAxis: 'Clear',
          axisSetAnnouncement: 'Sort axis set to {param}',
          axisClearedAnnouncement: 'Sort axis cleared',
          gridSpacingLabel: 'Grid spacing',
          gridSpacingValue: '{value} px',
          gridSpacingDisabledTooltip: 'Pick a workflow first',
          showHiddenLabel: 'Show hidden'
        },
        assets: {
          excludedCount:
            '{count} asset excluded: no metadata | {count} assets excluded: no metadata',
          excludedTooltip: 'Tooltip body',
          excludedTooltipLabel: 'Why?'
        }
      }
    }
  }
})

// Stub all Phase 3 child components so the test is not coupled to their
// internals. We verify composition (presence / v-if gating) not child behaviour.
const stubs = {
  MoshpitWorkflowPicker: {
    template: '<div data-testid="stub-workflow-picker" />'
  },
  MoshpitTimeRangePicker: {
    template: '<div data-testid="stub-time-range-picker" />'
  },
  MoshpitFilterChipRow: {
    template: '<div data-testid="stub-filter-chip-row" />'
  },
  MoshpitGridSpacingControl: {
    template: '<div data-testid="stub-grid-spacing-control" />'
  },
  MoshpitShowHiddenToggle: {
    template: '<div data-testid="stub-show-hidden-toggle" />'
  }
}

function mountPanel() {
  return render(MoshpitSettingsPanel, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      directives: {
        tooltip: { mounted: () => {} }
      },
      stubs
    }
  })
}

describe('MoshpitSettingsPanel excluded-count row', () => {
  beforeEach(() => {
    // Reset pinia between tests is handled by createTestingPinia
  })

  it('hides the row when excludedCount === 0', () => {
    mountPanel()
    expect(screen.queryByTestId('moshpit-excluded-count')).toBeNull()
  })

  it('shows singular copy when excludedCount === 1', async () => {
    mountPanel()
    const store = useMoshpitMetadataStore()
    store.excludedCount = 1
    await new Promise((r) => setTimeout(r, 0))
    expect(
      screen.getByText('1 asset excluded: no metadata')
    ).toBeInTheDocument()
  })

  it('shows plural copy when excludedCount === 3', async () => {
    mountPanel()
    const store = useMoshpitMetadataStore()
    store.excludedCount = 3
    await new Promise((r) => setTimeout(r, 0))
    expect(
      screen.getByText('3 assets excluded: no metadata')
    ).toBeInTheDocument()
  })

  it('info icon exposes aria-label and aria-describedby', async () => {
    mountPanel()
    const store = useMoshpitMetadataStore()
    store.excludedCount = 2
    await new Promise((r) => setTimeout(r, 0))
    const icon = screen.getByRole('img', { name: /why\?/i })
    expect(icon).toHaveAttribute('aria-describedby')
  })
})

describe('MoshpitSettingsPanel Phase 3 composition', () => {
  it('renders MoshpitWorkflowPicker unconditionally', () => {
    mountPanel()
    expect(screen.getByTestId('stub-workflow-picker')).toBeInTheDocument()
  })

  it('renders MoshpitTimeRangePicker unconditionally', () => {
    mountPanel()
    expect(screen.getByTestId('stub-time-range-picker')).toBeInTheDocument()
  })

  it('renders MoshpitGridSpacingControl unconditionally', () => {
    mountPanel()
    expect(screen.getByTestId('stub-grid-spacing-control')).toBeInTheDocument()
  })

  it('renders MoshpitShowHiddenToggle unconditionally', () => {
    mountPanel()
    expect(screen.getByTestId('stub-show-hidden-toggle')).toBeInTheDocument()
  })

  it('hides MoshpitFilterChipRow when filterStore.workflow is null', () => {
    mountPanel()
    expect(screen.queryByTestId('stub-filter-chip-row')).toBeNull()
  })

  it('shows MoshpitFilterChipRow when filterStore.workflow is set', async () => {
    mountPanel()
    const filterStore = useMoshpitFilterStore()
    filterStore.workflow = 'abc123fingerprint'
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('stub-filter-chip-row')).toBeInTheDocument()
  })
})
