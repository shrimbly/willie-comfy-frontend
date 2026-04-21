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
          sectionLabel: 'Filter'
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

// Stub all child components so the test is not coupled to their internals.
// We verify composition (presence / v-if gating / layout order) not child behaviour.
const stubs = {
  MoshpitWorkflowPicker: {
    template: '<div data-testid="stub-workflow-picker" />'
  },
  MoshpitTimeRangePicker: {
    template: '<div data-testid="stub-time-range-picker" />'
  },
  MoshpitGroupingToggles: {
    template: '<div data-testid="stub-grouping-toggles" />'
  },
  MoshpitFilterChipRow: {
    template: '<div data-testid="stub-filter-chip-row" />'
  },
  MoshpitWithinClusterSort: {
    template: '<div data-testid="stub-within-cluster-sort" />'
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

describe('MoshpitSettingsPanel gated composition (Phase 4)', () => {
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

  it('hides gated-only components when filterStore is not gated', () => {
    mountPanel()
    expect(screen.queryByTestId('stub-grouping-toggles')).toBeNull()
    expect(screen.queryByTestId('stub-filter-chip-row')).toBeNull()
    expect(screen.queryByTestId('stub-within-cluster-sort')).toBeNull()
  })

  it('renders grouping toggles, chip row and within-cluster sort once gated', async () => {
    mountPanel()
    const filterStore = useMoshpitFilterStore()
    filterStore.workflow = 'abc123fingerprint'
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('stub-grouping-toggles')).toBeInTheDocument()
    expect(screen.getByTestId('stub-filter-chip-row')).toBeInTheDocument()
    expect(screen.getByTestId('stub-within-cluster-sort')).toBeInTheDocument()
  })

  it('renders gated components in the documented layout order (grouping → chips → within-sort → spacing → show-hidden)', async () => {
    mountPanel()
    const filterStore = useMoshpitFilterStore()
    filterStore.workflow = 'abc123fingerprint'
    await new Promise((r) => setTimeout(r, 0))

    const expectedOrder = [
      'stub-grouping-toggles',
      'stub-filter-chip-row',
      'stub-within-cluster-sort',
      'stub-grid-spacing-control',
      'stub-show-hidden-toggle'
    ]

    const nodes = expectedOrder.map((id) => screen.getByTestId(id))

    // Each node must appear after the previous in document order.
    for (let i = 1; i < nodes.length; i++) {
      const previous = nodes[i - 1]
      const current = nodes[i]
      const relation = previous.compareDocumentPosition(current)
      expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })
})
