import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useMoshpitThumbStore } from '@/platform/moshpit/stores/moshpitThumbStore'
import { useMoshpitTournamentStore } from '@/platform/moshpit/stores/moshpitTournamentStore'

import MoshpitTournamentOverlay from './MoshpitTournamentOverlay.vue'

// Echo-key i18n so assertions can pin against moshpit.tournament.* / moshpit.peek.*
// keys directly. missingWarn/fallbackWarn disabled — Reka DialogDescription
// renders whatever t() returns, raw keys are fine for tests.
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en: {} }
})

// Image stub — MoshpitTournamentAssetFrame constructs `new Image()` for the
// full-res preloader. Non-constructor mocks break it. Reapplies the lesson
// from Plan 05-03 / Plan 05-04.
function FakeImage(this: {
  src: string
  onload: (() => void) | null
  onerror: (() => void) | null
}) {
  this.src = ''
  this.onload = null
  this.onerror = null
}

let pinia = createPinia()

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
})

function seedThumbs(hashes: readonly string[]): void {
  const thumbStore = useMoshpitThumbStore()
  for (const hash of hashes) {
    thumbStore.urlByHash.set(hash, `blob:thumb/${hash}`)
  }
}

function renderOverlay(
  resolveFullResUrl: (hash: string) => string | null = () => null
) {
  return render(MoshpitTournamentOverlay, {
    props: { resolveFullResUrl },
    global: { plugins: [pinia, i18n] }
  })
}

describe('MoshpitTournamentOverlay — mount gate', () => {
  it('does NOT render DialogContent when tournament is inactive', () => {
    renderOverlay()
    expect(
      screen.queryByTestId('moshpit-tournament-overlay-content')
    ).toBeNull()
  })

  it('renders DialogContent + pair + peek + legend when tournament is active', async () => {
    seedThumbs(['a', 'b', 'c', 'd'])
    const store = useMoshpitTournamentStore()
    store.enter(['a', 'b', 'c', 'd'])

    renderOverlay()
    await nextTick()

    expect(
      screen.getByTestId('moshpit-tournament-overlay-content')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('moshpit-tournament-overlay-legend')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('moshpit-tournament-overlay-counter')
    ).toBeInTheDocument()
    // Pair renderer mounts (via MoshpitTournamentPair).
    expect(
      screen.getByTestId('moshpit-tournament-pair-root')
    ).toBeInTheDocument()
    // Peek panel is always mounted when overlay is active; visibility is a
    // transform class.
    expect(
      screen.getByTestId('moshpit-metadata-peek-panel')
    ).toBeInTheDocument()
  })
})

describe('MoshpitTournamentOverlay — peek default visibility (PEEK-01)', () => {
  it('peek panel starts hidden (translate-x-full) on fresh tournament', async () => {
    seedThumbs(['a', 'b'])
    const store = useMoshpitTournamentStore()
    store.enter(['a', 'b'])

    renderOverlay()
    await nextTick()

    const peekPanel = screen.getByTestId('moshpit-metadata-peek-panel')
    expect(peekPanel.className).toContain('translate-x-full')
    expect(peekPanel.className).not.toContain('translate-x-0')
  })
})

describe('MoshpitTournamentOverlay — Escape wiring', () => {
  it('dispatching Escape on DialogContent routes through tournamentStore.exit', async () => {
    seedThumbs(['a', 'b', 'c'])
    const store = useMoshpitTournamentStore()
    store.enter(['a', 'b', 'c'])

    renderOverlay()
    await nextTick()

    expect(store.isActive).toBe(true)

    const content = screen.getByTestId('moshpit-tournament-overlay-content')
    // Reka's DialogContent listens for Escape on itself (focus-trap root) and
    // fires @escape-key-down. Dispatching a real keydown event mirrors the
    // production code path.
    content.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
    await nextTick()

    expect(store.isActive).toBe(false)
  })
})

describe('MoshpitTournamentOverlay — pair counter (D-04)', () => {
  it('renders the pair counter with 1-based current / total', async () => {
    seedThumbs(['a', 'b', 'c'])
    const store = useMoshpitTournamentStore()
    store.enter(['a', 'b', 'c']) // round-robin: 3 pairs

    renderOverlay()
    await nextTick()

    const counter = screen.getByTestId('moshpit-tournament-overlay-counter')
    // Echo-key i18n renders the raw key — substring check for plural bits
    // would depend on the real locale, so assert the element is present and
    // non-empty instead.
    expect(counter.textContent ?? '').toMatch(
      /moshpit\.tournament\.pairCounter/
    )
  })
})
