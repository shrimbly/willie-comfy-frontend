import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useMoshpitFilterStore } from '@/platform/moshpit/stores/moshpitFilterStore'
import { useMoshpitLightboxStore } from '@/platform/moshpit/stores/moshpitLightboxStore'
import { useMoshpitOverrideStore } from '@/platform/moshpit/stores/moshpitOverrideStore'
import { useMoshpitSelectionStore } from '@/platform/moshpit/stores/moshpitSelectionStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'

import MoshpitView from './MoshpitView.vue'

// Echo-key i18n — tests assert against moshpit.tournament.* keys; missingWarn /
// fallbackWarn disabled because useI18n() would otherwise flood stderr with
// raw-key warnings from every overlay/legend render.
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en: {} }
})

// Stub child components so we test composition, not internals. Each stub
// preserves the real component's key data-testid so the assertion stays
// black-box.
const stubs = {
  MoshpitCanvas: {
    template: '<div data-testid="stub-moshpit-canvas" />'
  },
  MoshpitClusterOverlay: {
    template: '<div data-testid="moshpit-cluster-overlay" />'
  },
  MoshpitEmptyGateOverlay: {
    template: '<div data-testid="stub-moshpit-empty-gate" />'
  },
  MoshpitMarqueeOverlay: {
    template: '<div data-testid="stub-moshpit-marquee" />'
  },
  MoshpitTournamentOverlay: {
    template: '<div data-testid="stub-moshpit-tournament-overlay" />'
  },
  MoshpitLightboxOverlay: {
    template: '<div data-testid="stub-moshpit-lightbox-overlay" />'
  }
}

function mountView() {
  return render(MoshpitView, {
    global: {
      plugins: [
        createTestingPinia({ createSpy: vi.fn, stubActions: false }),
        i18n
      ],
      stubs
    }
  })
}

describe('MoshpitView cluster overlay mount', () => {
  it('mounts MoshpitClusterOverlay parallel to MoshpitCanvas', () => {
    mountView()
    expect(screen.getByTestId('moshpit-cluster-overlay')).toBeInTheDocument()
  })

  it('still mounts the other legacy overlays (empty-gate, marquee)', () => {
    mountView()
    expect(screen.getByTestId('stub-moshpit-empty-gate')).toBeInTheDocument()
    expect(screen.getByTestId('stub-moshpit-marquee')).toBeInTheDocument()
  })

  it('mounts MoshpitTournamentOverlay as a sibling', () => {
    mountView()
    expect(
      screen.getByTestId('stub-moshpit-tournament-overlay')
    ).toBeInTheDocument()
  })

  it('mounts MoshpitLightboxOverlay as a sibling', () => {
    mountView()
    expect(
      screen.getByTestId('stub-moshpit-lightbox-overlay')
    ).toBeInTheDocument()
  })
})

describe('MoshpitView Enter-key opens lightbox', () => {
  it('is a no-op when nothing is selected', async () => {
    mountView()
    const lightbox = useMoshpitLightboxStore()
    const container = screen.getByTestId('moshpit-canvas-container')

    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    await nextTick()

    expect(lightbox.isOpen).toBe(false)
  })

  it('opens the lightbox with the current selection when Enter is pressed', async () => {
    mountView()
    const selectionStore = useMoshpitSelectionStore()
    const lightbox = useMoshpitLightboxStore()

    selectionStore.setSelection(['hashA', 'hashB', 'hashC'])

    const container = screen.getByTestId('moshpit-canvas-container')
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    await nextTick()

    expect(lightbox.isOpen).toBe(true)
    expect(lightbox.hashes).toEqual(['hashA', 'hashB', 'hashC'])
  })

  it('does not open the lightbox while tournament is active', async () => {
    mountView()
    const selectionStore = useMoshpitSelectionStore()
    const tournamentStore = useMoshpitTournamentStore()
    const lightbox = useMoshpitLightboxStore()

    selectionStore.setSelection(['hashA', 'hashB'])
    tournamentStore.enter(['hashA', 'hashB'])

    const container = screen.getByTestId('moshpit-canvas-container')
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    await nextTick()

    expect(lightbox.isOpen).toBe(false)
  })
})

describe('MoshpitView override-clear on grouping change', () => {
  it('clears all sprite overrides when activeGroupings changes', async () => {
    mountView()
    const overrideStore = useMoshpitOverrideStore()
    const filterStore = useMoshpitFilterStore()

    overrideStore.setPin('abc', { x: 10, y: 20 })
    overrideStore.setScale('xyz', 1.5)
    await nextTick()
    expect(overrideStore.records.size).toBe(2)

    filterStore.toggleGrouping('workflow')
    await nextTick()

    expect(overrideStore.records.size).toBe(0)
    expect(overrideStore.isPinned('abc')).toBe(false)
  })

  it('does not clear overrides when within-cluster sort changes', async () => {
    mountView()
    const overrideStore = useMoshpitOverrideStore()
    const filterStore = useMoshpitFilterStore()

    overrideStore.setPin('abc', { x: 10, y: 20 })
    overrideStore.setScale('xyz', 1.5)
    await nextTick()

    filterStore.setWithinClusterSort('oldestFirst')
    await nextTick()

    expect(overrideStore.records.size).toBe(2)
  })

  it('does not clear overrides when grid spacing changes', async () => {
    mountView()
    const overrideStore = useMoshpitOverrideStore()
    const filterStore = useMoshpitFilterStore()

    overrideStore.setPin('abc', { x: 10, y: 20 })
    overrideStore.setScale('xyz', 1.5)
    await nextTick()

    filterStore.setGridSpacing(600)
    await nextTick()

    expect(overrideStore.records.size).toBe(2)
  })
})
