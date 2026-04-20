import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/vue'
import { computed, ref, shallowRef } from 'vue'

import {
  MOSHPIT_VIEWPORT_INJECTION_KEY
} from '@/platform/moshpit/composables/useMoshpitViewportInjection'
import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import type { ColumnDescriptor, RowDescriptor } from '@/platform/moshpit/services/sortMath'
import MoshpitAxisOverlay from './MoshpitAxisOverlay.vue'

// Fixture descriptors
const COLUMNS: ColumnDescriptor[] = [
  { paramValue: '7', columnIndex: 0, worldX: 0 },
  { paramValue: '8', columnIndex: 1, worldX: 560 }
]

const ROWS: RowDescriptor[] = [
  { paramValue: 'euler', rowIndex: 0, worldY: 0 },
  { paramValue: 'dpmpp_2m', rowIndex: 1, worldY: 560 }
]

// Module-level stubs for useMoshpitFilteredAssets return values.
// These are replaced per test via columnsStub / rowsStub / axisModeStub.
const columnsStub = ref<readonly ColumnDescriptor[]>(COLUMNS)
const rowsStub = ref<readonly RowDescriptor[]>([])
const axisModeStub = ref<'chaos' | '1d' | '2d'>('1d')

vi.mock(
  '@/platform/moshpit/composables/useMoshpitFilteredAssets',
  () => ({
    useMoshpitFilteredAssets: () => ({
      columns: computed(() => columnsStub.value),
      rows: computed(() => rowsStub.value),
      axisMode: computed(() => axisModeStub.value)
    })
  })
)

// Fake viewport — satisfies the toScreen / on / off contract used by the overlay.
function makeFakeViewport() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    toScreen: vi.fn().mockReturnValue({ x: 100, y: 50 })
  }
}

let pinia = createPinia()

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  // Reset stubs to sane defaults
  columnsStub.value = COLUMNS
  rowsStub.value = []
  axisModeStub.value = '1d'
})

/** Mount overlay with a provided fake viewport (or null to simulate pre-init). */
function renderWithViewport(viewport: ReturnType<typeof makeFakeViewport> | null = null) {
  const viewportRef = shallowRef(viewport)

  return render(MoshpitAxisOverlay, {
    global: {
      plugins: [pinia],
      provide: {
        [MOSHPIT_VIEWPORT_INJECTION_KEY as unknown as string]: viewportRef
      }
    }
  })
}

describe('MoshpitAxisOverlay', () => {
  it('does not render when axisMode is chaos (no sort set)', () => {
    axisModeStub.value = 'chaos'
    renderWithViewport(makeFakeViewport())
    expect(screen.queryByTestId('moshpit-axis-overlay')).toBeNull()
  })

  it('does not render when viewport is null (pre-init)', () => {
    axisModeStub.value = '1d'
    renderWithViewport(null)
    expect(screen.queryByTestId('moshpit-axis-overlay')).toBeNull()
  })

  it('renders the overlay container when sortX is active and viewport is ready', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortX('cfg')
    axisModeStub.value = '1d'
    renderWithViewport(makeFakeViewport())
    expect(screen.getByTestId('moshpit-axis-overlay')).toBeTruthy()
  })

  it('renders X-axis labels matching columns length', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortX('cfg')
    axisModeStub.value = '1d'
    columnsStub.value = COLUMNS
    renderWithViewport(makeFakeViewport())
    const xLabels = screen.getAllByTestId('moshpit-axis-label-x')
    expect(xLabels).toHaveLength(COLUMNS.length)
  })

  it('renders both X and Y labels in 2D sort mode', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortX('cfg')
    filterStore.setSortY('sampler')
    axisModeStub.value = '2d'
    columnsStub.value = COLUMNS
    rowsStub.value = ROWS
    renderWithViewport(makeFakeViewport())
    expect(screen.getAllByTestId('moshpit-axis-label-x')).toHaveLength(COLUMNS.length)
    expect(screen.getAllByTestId('moshpit-axis-label-y')).toHaveLength(ROWS.length)
  })

  it('does not render Y-axis labels when sortY is null (1D mode)', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortX('cfg')
    axisModeStub.value = '1d'
    rowsStub.value = []
    renderWithViewport(makeFakeViewport())
    expect(screen.queryByTestId('moshpit-axis-label-y')).toBeNull()
  })

  it('formats timestamp axis labels as localized dates', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortX('timestamp')
    axisModeStub.value = '1d'
    // Apr 21, 2026 in UTC — use a specific epoch so the formatted date is predictable
    const epoch = new Date('2026-04-21').getTime()
    columnsStub.value = [{ paramValue: String(epoch), columnIndex: 0, worldX: 0 }]
    renderWithViewport(makeFakeViewport())
    const label = screen.getByTestId('moshpit-axis-label-x').textContent?.trim() ?? ''
    // Date formatted as "Apr 21" or locale equivalent — just check it's not the raw epoch
    expect(label).not.toBe(String(epoch))
    expect(label.length).toBeGreaterThan(0)
  })

  it('formats loras axis label as singular "N LoRA" when count is 1', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortX('loras')
    axisModeStub.value = '1d'
    columnsStub.value = [{ paramValue: '1', columnIndex: 0, worldX: 0 }]
    renderWithViewport(makeFakeViewport())
    expect(screen.getByTestId('moshpit-axis-label-x').textContent?.trim()).toBe('1 LoRA')
  })

  it('formats loras axis label as plural "N LoRAs" when count is not 1', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortX('loras')
    axisModeStub.value = '1d'
    columnsStub.value = [{ paramValue: '3', columnIndex: 0, worldX: 0 }]
    renderWithViewport(makeFakeViewport())
    expect(screen.getByTestId('moshpit-axis-label-x').textContent?.trim()).toBe('3 LoRAs')
  })

  it('overlay container has pointer-events-none class', () => {
    const filterStore = useMoshpitFilterStore()
    filterStore.setSortX('cfg')
    axisModeStub.value = '1d'
    renderWithViewport(makeFakeViewport())
    const overlay = screen.getByTestId('moshpit-axis-overlay')
    expect(overlay.classList.contains('pointer-events-none')).toBe(true)
  })
})
